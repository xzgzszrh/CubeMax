# ClassroomKit —— 课堂应用能力层

已安装的应用（extension）通过 ClassroomKit 读班级、读设备、写提示词、注册 MCP 工具，
并以「会话」为单位临时接管一批方糖猫。

本文档说明能力清单、两条调用轨、以及三个必须理解的约束：**每台设备一条独立 MCP 通道**、
**方糖猫只认提示词和工具表**、**接管必须有始有终**。

---

## 一、先理解设备侧的三个事实

### 1. 连接方向是反的，设备身份来自连接本身

BuildingAI 是 MCP **服务端**（提供工具），方糖猫是客户端（调用工具）；但主动拨号的是
BuildingAI —— 它连到小智那边的 WS 地址，再在这条连接上应答对方的 MCP 请求。

```
BuildingAI 网关  ──拨号──▶  wss://api.xiaozhi.me/mcp/?token=<每设备唯一>
   （MCP 服务端）                （MCP 客户端 = 方糖猫）
   ◀── initialize / tools/list / tools/call ──
```

每台设备在小智侧有各自带令牌的接入地址，`xiaozhi_mcp_connection` 表对 `agentBindingId`
唯一 —— **一台设备一条通道**。因此网关收到 `tools/call` 时，是哪条 socket 就是哪台设备，
不需要、也不应该让调用方用参数自报身份。

应用的工具 handler 收到的 `ClassroomToolContext` 就是这样推导出来的，**不可伪造**：

```ts
{
  agentBindingId,   // 哪台设备
  agentName,
  organizationId,   // 哪个班
  ownerUserId,      // 绑定这台设备的账号
  assignedUserId,   // 设备当前分发给哪个学生，未分发时 null
  sessionId,        // 哪次会话注册的这个工具
}
```

### 2. 方糖猫只认两样东西：提示词和工具表

它**无法感知**"现在在不在上课"。要让它改变行为，只有改提示词或改工具表两条路。

这解释了 ClassroomKit 的两个设计：

- `appendPrompt()` 而不是只有 `applyPrompt()` —— 应用要让模型知道"什么时候该调你的工具"
  就必须写进提示词，但整段覆盖会抹掉老师写的角色设定，所以提供追加。
- `suppressClassroomTool` —— 见下节。

### 3. 内置的 `classroom_report_completion` 默认存在，且可被会话隐藏

它服务于另一种课堂场景（老师用「课堂活动」简单编排，设备完成任务后上报）。
它**不是**接入 MCP 的必要条件，也不表示"正在上课"：设备调用后服务端才去查有没有
active 的课堂活动，没有就回 `accepted:false, reason:"no_active_classroom"` —— 事后拒绝，
下次模型照样会调。

因此应用有两个选择：

| 选择 | 做法 | 适用 |
|---|---|---|
| 复用内置工具 | 保持 `suppressClassroomTool: false`（默认） | 应用只需要"设备完成了任务"这一种上报，不想自己造工具 |
| 自己接管 | `suppressClassroomTool: true` | 应用有语义重叠的自定义上报工具 |

置 `true` 时，内置工具在本次会话覆盖的设备上**从 `tools/list` 里整个消失**，而不是留在表里
等调用后再拒绝。对一个只会照着工具表挑工具的模型来说，这是唯一有效的做法 —— 两个语义
重叠的工具同时挂着，它没有任何依据选对。

多个会话覆盖同一台设备时取"或"：只要有一个应用声明接管，就不暴露内置工具。会话结束自动恢复。

---

## 二、两条调用轨

| | SDK 轨（应用后端） | HTTP 轨（应用前端） |
|---|---|---|
| 入口 | `import { ClassroomKitService } from "@buildingai/extension-sdk"` | `/api/classroom-kit/:extension/*` |
| 注册 MCP 工具 | ✅ | ❌ handler 是函数，无法经 JSON 传递 |
| 其余能力 | ✅ | ✅ |

两条轨调的是**同一个** `ClassroomKitService`，权限断言只有一份，不存在两套授权逻辑。

`ClassroomKitModule` 由宿主在根模块以 `@Global()` 提供，应用**不要**再 `imports` 一次 ——
重复提供会造出第二个工具注册表，网关就看不见应用注册的工具了。直接注入即可：

```ts
@Injectable()
export class SafeCrackerService {
    constructor(private readonly kit: ClassroomKitService) {}
}
```

HTTP 轨路径里的 `:extension` 只用于会话归属与排障。它由前端传入、可被伪造，但所有操作
都按调用者在该班级的**权限**判定，冒用别的应用标识不会让任何人多拿到一点权限。

---

## 三、能力清单

所有方法第一个参数都是 `ClassroomCaller`：

```ts
{ userId, organizationId, extensionIdentifier }
```

`organizationId` 为 `null` 表示个人空间。每个方法第一行都会做工作空间权限断言。

### 课堂信息

| 方法 | 权限 | 说明 |
|---|---|---|
| `getClassroom(caller)` | `asset:read` | 班级名称、人数、设备数、调用者自己的身份 |
| `listMembers(caller)` | `member:read` | 成员列表，附带每人分到的方糖猫 |

### 设备信息

| 方法 | 权限 | 说明 |
|---|---|---|
| `listDevices(caller, { assignedUserId? })` | `asset:read` | 设备列表 |
| `getDevice(caller, agentBindingId)` | `asset:read` | 单台设备 |
| `readDeviceConfig(caller, agentBindingId)` | `asset:read` | 读上游当前配置（含提示词） |

设备对象里两个字段值得注意：

- `mcpConnected` —— MCP 通道是否已连上；**没接入 MCP 时是 `null`，不是 `false`**。
  没接入的设备收不到应用工具，游戏开始前应该先筛掉。
- `sessionIds` —— 当前正接管这台设备的会话，用于在界面上标出「上课中」。

### 提示词与配置

| 方法 | 权限 | 说明 |
|---|---|---|
| `applyPrompt(caller, { [agentBindingId]: character })` | `asset:manage` | 逐设备覆盖提示词 |
| `appendPrompt(caller, ids, snippet, separator?)` | `asset:manage` | 在现有提示词后追加，**幂等**（已含该片段则不重复追加） |
| `applyDeviceConfig(caller, targets)` | `asset:manage` | 下发任意课堂配置字段 |

可写的字段限于 `CLASSROOM_DEVICE_CONFIG_KEYS`（与场景共用同一组）：

```
language, tts_voice, character, asr_speed, tts_speech_speed, tts_pitch,
llm_model, memory_type, teen_mode, mcp_endpoints, knowledge_base_ids
```

这个范围**不是任意收紧的**：接管的快照与恢复用的也是这组字段。如果允许写一个恢复不了的
字段，它会永久留在学生的设备上。

批量下发**单台失败不打断整批**，返回逐台结果：

```ts
[{ agentBindingId, name, success, message? }]
```

一个班总有几台设备离线，因为一台失败就整批回滚在课堂上没有意义。

### 会话（接管与归还）

```ts
await kit.startSession(caller, {
    sessionKey: `safe-${organizationId}`,   // 应用内唯一
    title: "破解保险箱",
    agentBindingIds: [...],
    tools: [{ name: "safe_unlock_attempt", inputSchema, handler: (args, ctx) => ... }],
    suppressClassroomTool: true,
    lockStudentEdits: true,
    prompts: { [deviceA]: "你守着密码 4821…", [deviceB]: "你守着密码 1739…" },
    durationMinutes: 45,
    metadata: { round: 1 },
});
```

| 方法 | 权限 | 说明 |
|---|---|---|
| `startSession(caller, input)` | `asset:manage` | 快照 → 落库 → 挂工具 → 下发提示词 |
| `rearmSession(caller, key, tools, ids?)` | `asset:manage` | 调整工具或设备范围，**不重新快照** |
| `endSession(caller, key)` | `asset:manage` | 恢复配置 → 注销工具 → 解锁 |
| `getSession(caller, key)` | `asset:read` | 查会话 |
| `listActiveSessions(extension)` | — | 该应用所有未结束的会话 |

**执行顺序是刻意的**：

1. 逐台读取并**快照**当前配置（读不到的设备直接不纳入本次接管 —— 改了却恢复不回来，
   比少接管一台糟糕得多）
2. 快照**落库**
3. 挂载工具
4. 才下发新提示词

第 2 步在第 4 步之前，是因为下发到一半崩溃时快照必须已经durable，否则恢复不回来。
第 3 步在第 4 步之前，是因为提示词里若写了"用某工具上报"，工具必须已经在表里，
否则设备可能在中间窗口读到一份指向不存在工具的人设。

用**同一个 `sessionKey`** 再次 `startSession` 会先把上一局正常结束（含恢复）再开新局。
所以第二局的快照是学生的原始人设，而不是第一局的游戏人设 —— 可以放心重开。

### 学生端锁定

`lockStudentEdits: true` 期间，被接管设备的学生**不能修改自己方糖猫的任何设置**。

拦截点在 `XiaozhiService.resolveLinkableAgent()` —— 学生所有的写入路径
（改配置、改名、绑定/同步 BuildingAI 智能体）都经过它。老师（`asset:manage`）不受限制，
否则应用自己的下发也会被挡住（应用是以发起会话的老师身份下发的）。

这与老师长期设置的 `lockedConfigKeys` 是**两件事**：后者是老师手动锁定的字段，长期有效；
前者是会话级的全量锁定，随会话自动加解。

---

## 四、崩溃与超时：接管为什么必须能自愈

应用接管设备后，学生的方糖猫顶着游戏人设、并且自己改不回去。如果接管状态只活在内存里，
以下任一情况都会让学生永久卡住：

- 老师直接关掉页面，没点结束
- 应用崩溃后再没回来
- 服务重启

因此：

1. **会话落库**（`classroom_app_session` 表），含逐设备快照
2. **每个会话都有 `expiresAt`**（默认 3 小时，`durationMinutes` 可调）
3. **定时清理**：`ClassroomSessionSweeperService` 每 5 分钟扫一次，把过期会话正常结束 ——
   恢复配置、注销工具、解锁学生端

服务重启后工具注册表是空的（handler 是函数，无法持久化）。应用应在自己的
`onModuleInit` 里把工具挂回来：

```ts
async onModuleInit() {
    for (const session of await this.kit.listActiveSessions("safe-cracker")) {
        await this.kit.rearmSession(caller, session.sessionKey, this.tools);
    }
}
```

不 rearm 也不会造成数据损坏 —— 会话到期后照样会被清理并恢复，只是这段时间里
设备身上挂着游戏人设却没有可调用的工具。

---

## 五、教室大屏（白板页）

应用的大屏视图走独立全屏路由，**要求登录**，用老师自己的账号：

```
/board/:identifier/*      →  iframe 加载 /extension/:identifier/*?_mode=board
```

它刻意放在 `DefaultLayout` 之外 —— 大屏上不该出现侧边栏和账号菜单。应用通过
查询参数 `_mode=board` 判断该渲染老师面板还是大屏排行榜，不必自己约定路径规范。
常规入口 `/apps/:identifier/*` 不变，两者渲染同一个应用、共用同一个 iframe 组件。

### 为什么不会影响老师自己的控制台

分两种情况，都不会：

**同一台电脑**（老师笔记本接投影，最常见）—— 登录令牌存在 localStorage，同源新标签页
直接沿用，**根本不需要二次登录**，也就无从冲突。

**另一台大屏设备** —— 需要在那台机器上登录。服务端撤销旧令牌的
`revokeTokensByTerminal(userId, terminal)` 是**按终端分桶**的，而大屏登录走
`UserTerminal.SCREEN`（终端 5），老师电脑上的控制台是 `PC`（终端 1），
两个桶互不相干。

这一点不能只依赖"允许多处登录"这个开关：它确实默认开启（`login_settings.allowMultipleLogin`
默认 `true`，当前部署也没有覆盖它），但它是管理员可以关掉的。一旦关掉，如果大屏也按 PC
终端登录，老师在大屏上输完密码，自己电脑上的控制台就会被踢下线 —— 正在上课时发生这事很难看。
分终端让这件事**结构上不可能发生**，而不是碰巧没发生。

登录终端由跳转目标推导（`redirect` 以 `/board/` 开头即 SCREEN），不额外传标记，
免得两处失配。

---

## 六、权限一览

课堂能力复用组织权限，没有另起一套：

| 权限 | student | teacher | admin |
|---|---|---|---|
| `asset:read` 读班级/设备/配置 | ✗ | ✓ | ✓ |
| `member:read` 读成员 | ✗ | ✓ | ✓ |
| `asset:manage` 写配置/开会话 | ✗ | ✓ | ✓ |

个人空间（`organizationId` 为 `null`）视同全部权限。

ClassroomKit 住在 `packages/core`，不能反向 import 组织模块的权限枚举，因此自带了一份
同值字面量 `ClassroomKitPermission`。两边由
`packages/api/src/modules/organization/services/classroom-kit.spec.ts` 里的测试钉住 ——
一旦漂移，表现会是「明明是老师却提示没权限」，很难查。

---

## 七、代码位置

| 内容 | 路径 |
|---|---|
| 能力层 | `packages/core/src/modules/classroom/classroom-kit.service.ts` |
| 工具注册表 | `packages/core/src/modules/classroom/classroom-tool-registry.service.ts` |
| 外部依赖端口 | `packages/core/src/modules/classroom/classroom-workspace.port.ts` |
| 端口实现（api） | `packages/api/src/modules/organization/services/classroom-workspace.adapter.ts` |
| 超时清理 | `packages/api/src/modules/organization/services/classroom-session-sweeper.service.ts` |
| HTTP 轨 | `packages/api/src/modules/organization/controllers/classroom-kit.controller.ts` |
| MCP 网关 | `packages/api/src/modules/organization/services/xiaozhi-mcp.service.ts` |
| 大屏路由 | `packages/client/src/pages/apps/[identifier].tsx`（`basePath="/board"`）与 `packages/client/src/router/index.tsx` |
| 会话实体 | `packages/@buildingai/db/src/entities/classroom-app-session.entity.ts` |

能力层放在 `core` 而不是 `api`，是因为应用只能依赖 `@buildingai/core` / `@buildingai/extension-sdk`。
但权限判定和配置下发的实现在 `api`（后者持有加密的上游账号凭据），所以 core 只声明端口，
由 api 在启动时注入实现 —— core 不反向依赖 api。
