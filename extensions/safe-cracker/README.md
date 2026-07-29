# 破解保险箱（safe-cracker）

一款课堂互动游戏应用。老师给全班的方糖猫写入「你守着一个密码」的人设，学生通过与
自己的方糖猫对话把密码套出来，最快破解的上大屏排行榜。

这也是 BuildingAI 上第一个基于 **ClassroomKit 课堂能力层**开发的应用 ——
它不直接操作任何设备，所有对方糖猫的读写都经过能力层，因此天然带上了
接管快照、结束恢复、超时兜底和学生端锁定。

---

## 一、三个界面

| 界面 | 应用内路由 | 打开方式 | 谁看 |
|---|---|---|---|
| 老师面板 | `/`（index） | `/apps/safe-cracker` | 老师 |
| 学生端 | `/student` | `/apps/safe-cracker/student` | 学生 |
| 大屏 | `/board` | `/board/safe-cracker/board` | 投到教室屏幕 |

大屏走的是宿主的 `/board/:identifier/*` 独立全屏路由：不带侧边栏、深色高对比、
按人数自动分 1/2/3 列，40 人班也能一屏放下。它**要求登录**（老师自己的账号），
但登录时走 `SCREEN` 终端，不会踢掉老师电脑上的控制台会话，详见
`docs/classroom-kit.md` 第五节。

---

## 二、一局游戏的完整流程

```
老师面板                     ClassroomKit                    方糖猫
   │                              │                            │
   ├─ 选设备、配规则 ──────────────┤                            │
   ├─ 点「开始」                   │                            │
   │   ├─ 生成密码（每人不同/全班同一个）                        │
   │   ├─ 落库 session + participants  ← 密码先落库             │
   │   └─ startSession() ─────────►│                            │
   │                              ├─ 逐台快照原配置并落库        │
   │                              ├─ 挂载 safe_unlock_attempt ─►│
   │                              ├─ 隐藏内置 classroom 工具 ──►│
   │                              ├─ 下发游戏人设 ────────────►│
   │                              └─ 锁定学生端                 │
   │◄─ applied 回填 ready/readyError                            │
   │                                                            │
学生端                                                          │
   ├─ 倒计时开始                                                │
   ├─ 学生与方糖猫对话 ◄───────────────────────────────────────►│
   │                                                            │
   │  破解成功，两条上报路径（老师可各自开关）：                  │
   │  (a) 方糖猫自己调 safe_unlock_attempt ─────────────────────┤
   │  (b) 学生在页面输入密码 ───────────────────────────────────┤
   │                                                            │
大屏 ◄─ 排行榜每 2 秒刷新                                        │
   │                                                            │
   ├─ 老师点「结束」（或到时/超时兜底）                          │
   │   └─ endSession() ───────────►│                            │
   │                              ├─ 逐台恢复原配置 ──────────►│
   │                              ├─ 注销工具，恢复内置工具 ──►│
   │                              └─ 解除学生端锁定             │
```

**执行顺序是刻意的**：密码先落库再接管设备；快照先落库再下发人设。
中途崩溃时，已经被改写的设备仍然能靠落库的快照恢复回来。

---

## 三、老师可配的选项

| 选项 | 默认 | 说明 |
|---|---|---|
| 提示词模板 | 见 `DEFAULT_PROMPT_TEMPLATE` | 支持 `{{password}}`、`{{student}}` 占位符 |
| 密码模式 | 每人不同 | 「全班同一个」适合协作破解；「每人不同」适合竞速，也杜绝互相抄 |
| 密码位数 | 4 | 3–8 位纯数字 |
| 时长 | 15 分钟 | 到点自动结束并归还设备 |
| 允许设备上报 | 开 | 关掉则不注册 MCP 工具，方糖猫无法自动上报 |
| 允许学生输入 | 开 | 关掉则学生端不显示输入框 |
| 启用学生端 | 开 | 没有学生设备的课堂可以整个关掉 |
| 锁定学生修改 | 开 | 游戏期间学生不能改自己方糖猫的任何设置 |

两个上报开关**不能同时关**——否则没有任何途径提交密码，界面会禁用「开始」按钮。

---

## 四、必须理解的三件事

### 1. 方糖猫只认提示词和工具表

它无法感知"现在在不在上课"。所以应用做两件事让它进入游戏状态：改人设、挂工具。
`allowDeviceReport` 开启时，应用会在人设后**追加**一段上报规则（写明什么时候调
`safe_unlock_attempt`）——不写进人设，模型基本不会主动调用工具。

### 2. 游戏期间内置的 `classroom_report_completion` 会被隐藏

应用以 `suppressClassroomTool: true` 开启会话。内置工具服务于另一种课堂场景
（老师用「课堂活动」简单编排），与本应用的上报语义重叠。两个都挂在工具表里，
模型没有任何依据选对。会话结束后自动恢复。

### 3. 设备身份来自长连接，不可伪造

每台方糖猫在小智侧有独立的 MCP 接入地址，网关为每个地址维持一条 WebSocket。
`safe_unlock_attempt` 的 handler 拿到的 `ctx.agentBindingId` 是网关从连接推导的，
**不是设备自报的参数**。因此学生无法冒用别人的设备上报。

学生端提交同理：只按登录用户匹配 `studentUserId`，不信请求体里的任何身份声明。

---

## 五、接口

全部在 `@ExtensionWebController("game")` 下，实际前缀 `/safe-cracker/api/game`。

| 方法 | 路径 | 用途 | 权限 |
|---|---|---|---|
| GET | `/devices` | 可选设备列表 | `asset:read` |
| GET | `/current` | 本班最新一局（**含密码**） | 老师 |
| POST | `/` | 创建并开始 | 老师 |
| POST | `/:id/end` | 结束并归还设备 | 老师 |
| GET | `/mine` | 我这一局的状态 | 登录 |
| POST | `/mine/attempt` | 学生提交密码 | 登录 |
| GET | `/board` | 排行榜（**永不含密码**） | 登录 |

班级从 `x-organization-id` 头取，由 `createPluginHttpClients()` 自动带上。

---

## 六、数据

两张表，位于**独立的 `safe_cracker` schema**（`@ExtensionEntity()` 自动分配），
不与主库混在一起：

- `safe_game_session` —— 一局游戏的规则与状态，通过 `kitSessionKey` 关联到
  ClassroomKit 的接管会话
- `safe_game_participant` —— 一局里的一台方糖猫及其学生、密码、成绩

设备接管本身的状态（快照、锁定、超时）**不在这里**，在宿主的
`classroom_app_session` 表里。应用不该自己去管那些。

---

## 七、开发

```bash
# 依赖（本机 node 版本与仓库 engines 不符时加 --engine-strict=false）
pnpm install --filter safe-cracker...

# 开发（web + api 并行热更新）
pnpm --filter safe-cracker dev

# 检查
pnpm --filter safe-cracker lint
pnpm --filter safe-cracker check-types

# 打包产物（安装流程强制要求 build/ 与 .output/public/ 都存在）
pnpm --filter safe-cracker build:publish
```

### 两个容易踩的坑

1. **前后端共享类型必须放在 `src/api/` 之内**。tsup 是 `bundle: false` 且
   entry 只覆盖 `src/api/**`，放外面的文件不会被 emit，但产物里的相对 import
   会原样保留 —— 运行时 `Cannot find module`，而且 `tsc` 和 `vite build` 都发现不了。
   本应用的做法：真身在 `src/api/shared/contract.ts`，`src/shared/contract.ts`
   只有一行 `export *` 转给前端。

2. **可空列必须显式写 `type`**。`@Column({ nullable: true }) foo: string | null`
   会让 TypeORM 反射到 `Object` 而报 `DataTypeNotSupportedError`，**只在启动时才炸**，
   类型检查和构建全都是绿的。

更多打包与安装约束见 `docs/extension-packaging.md`。

---

## 八、目录

```
extensions/safe-cracker/
├── manifest.json          应用元信息
├── src/
│   ├── api/               后端（tsup → build/）
│   │   ├── shared/contract.ts       前后端共享契约（真身）
│   │   ├── db/entities/             两张表
│   │   └── modules/game/            服务、控制器、DTO
│   ├── shared/contract.ts           转出给前端
│   └── web/               前端（vite → .output/public/）
│       ├── pages/{index,student,board}.tsx
│       ├── services/                react-query hooks
│       └── hooks/use-countdown.ts   带服务器时间校正的倒计时
└── docs → ../../docs/classroom-kit.md（能力层说明）
```
