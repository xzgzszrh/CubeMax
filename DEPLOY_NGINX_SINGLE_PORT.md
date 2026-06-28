# BuildingAI 单公网端口部署记录

本文记录当前机器上 BuildingAI 的 Nginx 单端口反代配置，便于后续维护时快速恢复上下文。

## 当前部署结构

```text
公网访问
  |
  | http://服务器IP:28080
  v
Nginx 0.0.0.0:28080
  |
  v
BuildingAI API / Web 127.0.0.1:4090
  |
  |-- /                 前端静态页面，由后端托管 public/web
  |-- /api/*            前台 API
  |-- /consoleapi/*     后台 API

内部依赖：
PostgreSQL 127.0.0.1:5432
Redis      127.0.0.1:6379
```

对外只需要开放 `28080/tcp`。不要对外开放 `4090`、`5432`、`6379`。

## 关键文件

```text
/etc/nginx/sites-available/buildingai
/etc/nginx/sites-enabled/buildingai -> /etc/nginx/sites-available/buildingai
/root/project/BuildingAI/.env
/root/project/BuildingAI/public/web
/root/project/BuildingAI/logs/pm2
```

Ubuntu 默认 Nginx 站点已经禁用：

```text
/etc/nginx/sites-enabled/default
```

该链接已删除，避免 Nginx 继续监听 `80`。

## Nginx 配置

当前 Nginx 站点配置：

```nginx
server {
    listen 28080;
    server_name _;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:4090;

        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

说明：

- `listen 28080;` 是唯一对外公网端口。
- `proxy_pass http://127.0.0.1:4090;` 转发到 BuildingAI 后端。
- `proxy_buffering off;` 对 AI 流式输出很重要。
- `client_max_body_size 100m;` 允许较大的上传请求。

修改后检查并重载：

```bash
nginx -t
systemctl reload nginx
```

如果要彻底切换监听端口，可重启：

```bash
systemctl restart nginx
```

## BuildingAI 环境变量

项目环境文件：

```text
/root/project/BuildingAI/.env
```

当前与单端口部署相关的关键配置：

```env
APP_DOMAIN=http://YOUR_SERVER_IP:28080
SERVER_PORT=4090
SERVER_CORS_ENABLED=false
VITE_PRODUCTION_APP_BASE_URL=
VITE_APP_WEB_API_PREFIX=/api
VITE_APP_CONSOLE_API_PREFIX=/consoleapi
```

上线时建议把 `YOUR_SERVER_IP` 改成真实 IP 或域名，例如：

```env
APP_DOMAIN=http://1.2.3.4:28080
```

如果使用域名和 HTTPS，例如：

```env
APP_DOMAIN=https://ai.example.com
```

`VITE_PRODUCTION_APP_BASE_URL` 保持为空，表示前端生产包使用同源 API：

```text
http://服务器IP:28080/api/*
http://服务器IP:28080/consoleapi/*
```

## Node 版本

项目要求 Node：

```text
>=22.20.x <23
```

机器上使用 nvm 的 Node 22：

```bash
. /root/.nvm/nvm.sh
nvm use 22.23.1
```

运行项目命令前建议先执行上面两行，避免误用 Node 24。

## 内部依赖

已安装并启用：

```bash
apt install -y postgresql redis-server postgresql-16-pgvector
systemctl enable --now postgresql
systemctl enable --now redis-server
```

数据库配置匹配 `.env` 默认值：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=buildingai
REDIS_HOST=localhost
REDIS_PORT=6379
```

数据库用户和库：

```bash
su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'postgres';\""
su - postgres -c "createdb buildingai"
```

如果数据库已存在，`createdb` 会报已存在，可忽略。

## PostgreSQL 扩展

BuildingAI 初始化依赖：

- `vector`，来自 `postgresql-16-pgvector`
- `zhparser`，Ubuntu 24.04 默认源没有现成包，已通过源码编译安装

验证：

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d buildingai -c 'CREATE EXTENSION IF NOT EXISTS vector;'
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d buildingai -c 'CREATE EXTENSION IF NOT EXISTS zhparser;'
PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d buildingai -c "SELECT * FROM ts_parse('zhparser', '中文分词测试') LIMIT 5;"
```

预期能看到类似：

```text
 tokid | token
-------+-------
   110 | 中文
   118 | 分词
   118 | 测试
```

## zhparser 安装记录

安装编译依赖：

```bash
apt install -y build-essential postgresql-server-dev-16 wget ca-certificates autoconf automake libtool
```

安装 SCWS：

```bash
rm -rf /tmp/scws-release /tmp/scws.tar.bz2
mkdir -p /tmp/scws-release
wget -O /tmp/scws.tar.bz2 http://www.xunsearch.com/scws/down/scws-1.2.3.tar.bz2
tar -xjf /tmp/scws.tar.bz2 -C /tmp/scws-release --strip-components=1
cd /tmp/scws-release
./configure
make -j$(nproc)
make install
ldconfig
```

安装 zhparser：

```bash
rm -rf /tmp/zhparser
git clone --depth 1 https://github.com/amutu/zhparser.git /tmp/zhparser
cd /tmp/zhparser
PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config make
PG_CONFIG=/usr/lib/postgresql/16/bin/pg_config make install
ldconfig
```

## 构建和启动

进入项目：

```bash
cd /root/project/BuildingAI
. /root/.nvm/nvm.sh
nvm use 22.23.1
```

同步环境变量：

```bash
pnpm sync-env
```

构建：

```bash
pnpm build
```

启动：

```bash
pnpm pm2:start
```

查看状态：

```bash
pnpm pm2:status
```

查看日志：

```bash
pnpm pm2:logs
```

重启：

```bash
pnpm restart
```

注意：`pnpm restart` 会执行项目脚本，可能触发较重的 setup/predeploy/build 流程。只想看状态或日志时，用 `pnpm pm2:status` 和 `pnpm pm2:logs`。

## 验证命令

由于当前 shell 里可能存在代理环境变量，验证本机端口时建议加 `--noproxy '*'`。

检查监听端口：

```bash
ss -ltnp | rg ':(28080|4090|5432|6379)\b'
```

预期：

```text
0.0.0.0:28080       nginx
*:4090              PM2 / BuildingAI
127.0.0.1:5432      postgres
127.0.0.1:6379      redis-server
```

验证后端：

```bash
curl --noproxy '*' -I http://127.0.0.1:4090
```

验证 Nginx 首页：

```bash
curl --noproxy '*' -I http://127.0.0.1:28080
```

验证健康接口：

```bash
curl --noproxy '*' http://127.0.0.1:28080/consoleapi/health
```

当前健康接口预期返回：

```json
{"code":20000,"message":"ok","data":{"status":"ok"}}
```

外部访问地址：

```text
http://服务器IP:28080
```

## 常见问题

### 访问 28080 不通

检查 Nginx：

```bash
systemctl status nginx --no-pager -l
nginx -t
ss -ltnp | rg ':28080\b'
```

检查防火墙或云平台安全组是否开放：

```text
28080/tcp
```

### Nginx 返回 502

通常是后端 `4090` 没起来。

```bash
ss -ltnp | rg ':4090\b'
cd /root/project/BuildingAI
. /root/.nvm/nvm.sh
nvm use 22.23.1
pnpm pm2:status
pnpm pm2:logs
```

### 后端反复重启

看 PM2 错误日志：

```bash
tail -n 200 /root/project/BuildingAI/logs/pm2/api-error.log
tail -n 200 /root/project/BuildingAI/logs/pm2/api-out.log
```

曾遇到过的启动阻塞：

```text
Redis 未启动
PostgreSQL 未启动
extension "vector" is not available
extension "zhparser" is not available
```

对应处理：

```bash
systemctl enable --now redis-server
systemctl enable --now postgresql
apt install -y postgresql-16-pgvector
```

`zhparser` 需要按本文源码编译步骤安装。

### curl 本机返回奇怪的 502

当前环境可能配置了代理：

```bash
env | rg -i 'http_proxy|https_proxy|all_proxy|no_proxy'
```

本机验证时使用：

```bash
curl --noproxy '*' http://127.0.0.1:28080
```

## 当前最终状态

最后一次验证结果：

```text
http://127.0.0.1:28080                 200 OK
http://127.0.0.1:28080/consoleapi/health ok
http://127.0.0.1:8080                  不监听
```

公网只需要使用：

```text
28080/tcp
```
