# 应用包（Extension）打包与安装

本文记录**已验证的**安装链路事实，供开发应用时对照。所有结论都标了出处，
没有验证过的地方明确写「未验证」。

---

## 一、包是构建产物，不是源码

`ExtensionOperationService.ensurePluginStructure()`
（`packages/api/src/modules/extension/services/extension-operation.service.ts:737`）
在解压后**强制校验**两个目录必须存在，缺一个就整包拒收：

| 目录 | 来源 | 缺失时的报错 |
|---|---|---|
| `build/` | `pnpm build:api`（tsup） | `missing "build" directory` |
| `.output/public/` | `pnpm build:web`（vite） | `missing ".output/public" directory` |

所以**打包前必须先 `pnpm build:publish`**，并且这两个目录要进 zip。
仓库里 `simple-blog` 的 `.output/public/assets/*` 是纳入 git 版本管理的
（`.gitignore` 里有 `!extensions/simple-blog/.output`），自研应用照此办理。

`resolvePluginRoot()`（:762）允许包根目录是 zip 的顶层，也允许是 zip 里唯一的一层子目录 ——
`zip -r app.zip safe-cracker/` 和 `cd safe-cracker && zip -r ../app.zip .` 两种打法都认。

---

## 二、后端不打包，运行时从宿主解析依赖

`defineBuildingAITsupConfig`（`packages/@buildingai/extension-sdk/src/tsup.ts`）用的是
`bundle: false` + `format: ["cjs"]` —— 逐文件转译，**不打包**。因此 `build/*.js` 里
`require("@buildingai/core")` 这类调用会在运行时才解析。

这解释了为什么应用的 `package.json` 里写 `workspace:*` 也能跑：应用被解压进
`extensions/<identifier>/`，而 `extensions/*` 正是 `pnpm-workspace.yaml` 的一个 glob，
安装流程随后在仓库根目录执行 `pnpm install --no-frozen-lockfile`
（`installDependencies()`，:1253），把 `@buildingai/*` 软链进应用的 `node_modules`。

**由此推出一条硬约束**：`workspace:*` 只对宿主已有的包成立。第三方应用如果依赖
宿主没有的包，必须写成正常的版本号（`"lodash": "^4"`），靠那次 `pnpm install` 装下来。
前端不受此限 —— vite 是打包的，第三方依赖已经进了 `.output/public`。

---

## 三、安装流程的完整顺序

1. 下载 zip（`download()`，:347）—— 来源是应用市场 URL 或激活码
2. 解压到临时目录 → `resolvePluginRoot()` 找到包根
3. 读 `package.json`，**校验 `name` 不与已安装应用重名**（:566-584），重名直接回滚
4. 复制到 `extensions/<identifier>/`；**升级**走 `upgradeExtension()`（:690），
   只保留 `data` 和 `storage` 两个目录，其余全部覆盖
5. `patchLegacyDependencies()`（:611）—— 删除已下线的 `@buildingai/*` 包名、
   把 `@buildingai/service` 改写成 `@buildingai/services`
6. `ensurePluginStructure()` 结构校验
7. 根目录 `pnpm install --no-frozen-lockfile`
8. 同步扩展数据表、执行 seeds（:1612 起）
9. 调度 PM2 重启（应用后端是**同进程**加载的，不重启不生效）

> **注意**：升级只保留 `data` / `storage`。应用如果把状态写在别处（比如包内的
> 配置文件），升级会丢。

---

## 四、离「上传 zip 安装」还差什么

| 事项 | 状态 |
|---|---|
| zip 解压、结构校验、目录落位 | **已就绪** |
| 依赖安装、数据表同步、seeds、重启 | **已就绪** |
| 升级时保留用户数据 | **已就绪**（仅 `data` / `storage`） |
| **上传入口** | **缺失** —— 控制台只有 `POST install/:identifier`（市场 URL）和激活码安装两条路，没有接收上传文件的接口 |
| **来源校验 / 签名** | **缺失** —— 未见任何签名或校验机制 |
| **沙箱** | **不存在** —— 应用后端在主 NestJS 进程内加载，可注入任意 TypeORM 仓储。装第三方 zip 等同于让对方在你的进程里执行代码 |

前四项已经跑通，所以加一个「上传 zip」入口本身工作量不大：接收文件 → 落到临时路径 →
复用现有的 `extractPluginPackage()` 之后的全部流程即可。

**但第 5、6 项是真正的门槛**：在没有签名与沙箱的前提下开放任意 zip 上传，
等于把服务器交给上传者。建议要么限制为管理员可用并配合人工审核，要么先补签名校验。

---

## 五、开发应用时必须遵守的约束

1. **标识三处一致**：`manifest.json` 的 `identifier`、`package.json` 的 `name`、
   `defineRouteOption` 的 `base: extension/<name>` 必须完全相同，否则前端路由或后端
   命名空间会对不上。
2. **后端路由前缀是自动加的**：`@ExtensionWebController("game")` 的实际路径是
   `/<identifier>/api/game`，`@ExtensionConsoleController` 同理走 `/console`。
   **不要**自己在路径里拼 identifier。
3. **前端 http client 用 `createPluginHttpClients()`**，它自动带上
   `/<identifier>/api` 前缀、登录令牌、以及当前班级的 `x-organization-id` 头。
   写相对路径即可。
4. **实体必须放在 `src/api/db/entities/`** —— 这个路径是**载荷**不是约定。
   `@ExtensionEntity()`（`packages/core/src/decorators/extension-entity.decorator.ts:17`）
   靠在调用栈里查找 `/build/db/entities/` 来反推应用目录名，进而决定 PostgreSQL schema。
   放到别的目录，装饰器识别不出所属应用，schema 分配会失败。
5. **前后端共享的类型必须放在 `src/api/` 之内**。tsup 是 `bundle: false` 且
   `entry: ["src/api/**/*.ts"]`，放在 `src/api` 外面的文件**不会被 emit**，但产物里
   的相对 import 会被原样保留 —— 扩展加载时报 `Cannot find module`，而且
   `tsc --noEmit` 和 `vite build` 都发现不了（前端是打包的，类型检查也只看源码）。
   本仓库的做法见 `extensions/safe-cracker/src/shared/contract.ts`：真身放
   `src/api/shared/`，在 `src/shared/` 留一行 `export *` 转出给前端。
6. **静态资源**放 `src/api/static/`（后端）或走 vite（前端）；
   `src/api/db/seeds/data` 会被 tsup 自动拷进 `build/`。
7. **大屏页面**：宿主提供 `/board/<identifier>/*` 独立全屏路由，会以
   `?_mode=board` 加载应用。应用自己决定按 `_mode` 分支还是按路径分支。
8. **升级只保留 `data` / `storage`** —— 别把需要持久的东西写在包内其它位置。

---

## 六、代码位置

| 内容 | 路径 |
|---|---|
| 安装/升级/卸载 | `packages/api/src/modules/extension/services/extension-operation.service.ts` |
| 市场下载 | `packages/api/src/modules/extension/services/extension-market.service.ts` |
| 控制台接口 | `packages/api/src/modules/extension/controllers/console/extension.controller.ts` |
| tsup 默认配置 | `packages/@buildingai/extension-sdk/src/tsup.ts` |
| 扩展 schema 隔离 | `packages/core/src/modules/extension/` |
| 样板应用 | `extensions/simple-blog/` |
