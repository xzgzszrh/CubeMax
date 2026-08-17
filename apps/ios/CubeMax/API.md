# CubeMax iOS API 契约

CubeMax 使用原生 `URLSession` 调用 BuildingAI Web API。默认开发地址为
`http://127.0.0.1:4090/api`，生产环境通过登录页修改为部署地址。

## 请求约定

- 除登录、公开回调外，发送 `Authorization: Bearer <token>`。
- 当前组织工作区通过 `x-organization-id` 发送；个人空间不发送该请求头。
- 服务端通常返回 `{ "code": 0, "message": "ok", "data": ... }`。客户端也接受直接返回的 `data`，便于兼容旧接口。
- 401 时客户端清除 Keychain token 并回到登录页。

## 认证与工作区

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/auth/login` | `{ username, password, terminal: 4 }`，返回 `token`、`expiresAt`、`user` |
| GET | `/user/info` | 当前用户信息 |
| POST | `/auth/logout` | 撤销当前 token |
| GET | `/organizations/context` | 个人空间和组织工作区列表 |

## 触发器与工程

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/programming-triggers?page=1&pageSize=100` | 当前用户的触发器 |
| GET | `/programming-triggers/:id` | 触发器详情和表单 JSON Schema |
| POST | `/programming-triggers` | 创建表单触发器 |
| PATCH | `/programming-triggers/:id` | 修改启用、置顶和名称 |
| DELETE | `/programming-triggers/:id` | 删除触发器 |
| POST | `/programming-triggers/:id/execute` | `{ inputs: { ... } }`，返回运行任务 ID |
| GET | `/programming-projects?page=1&pageSize=100` | 创建触发器时选择已发布工程 |

表单字段直接来自工程主流程 `start` 节点的输入 Schema。客户端支持
`string`、`integer`、`number`、`boolean`、`object`、`array`、`enum`、默认值和必填校验。

## 对话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/ai-conversations?page=1&pageSize=50` | 对话列表 |
| POST | `/ai-conversations` | 创建对话 |
| GET | `/ai-conversations/:id/info` | 对话信息 |
| GET | `/ai-conversations/:id/messages?page=1&pageSize=100` | 消息列表 |
| POST | `/ai-chat` | AI SDK data stream；客户端解析 `data:` 行中的 text delta |

`/ai-chat` 请求需要 `modelId`（UUID）和 `messages`。客户端会优先使用已有对话的
`modelId`，新对话可在对话页输入默认模型 ID。

## 小米智能家居

账号管理位于“我的 > 我的智能家居”，设备页面只负责设备浏览和控制。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/smart-home/xiaomi/accounts` | 当前用户的小米账号 |
| POST | `/smart-home/xiaomi/import` | 导入 Home Assistant 本地脚本生成的凭据 JSON |
| POST | `/smart-home/xiaomi/accounts/:accountId/sync` | 同步家庭和设备 |
| PATCH | `/smart-home/xiaomi/accounts/:accountId` | 修改账号备注 |
| DELETE | `/smart-home/xiaomi/accounts/:accountId` | 删除账号及其设备缓存 |
| GET | `/smart-home/xiaomi/devices` | 当前用户全部设备 |
| GET | `/smart-home/xiaomi/devices/:deviceId` | 设备详情 |
| POST | `/smart-home/xiaomi/devices/:deviceId/refresh` | 刷新设备状态 |
| POST | `/smart-home/xiaomi/devices/:deviceId/properties` | `{ siid, piid, value }` |
| POST | `/smart-home/xiaomi/devices/:deviceId/actions` | `{ siid, aiid, in: [] }` |

设备控制能力由服务端返回的 `capabilities` 描述，客户端根据 `format`、
`valueRange`、`valueList` 生成原生 Toggle、Slider、Picker 或输入控件。

## CubeCat 设备管理

“我的 > CubeCat 设备”使用现有 Lua 设备网关接口展示设备在线状态、固件能力和执行记录。
工作流运行仍由触发器或工程页面发起，客户端不会绕过服务端直接连接设备。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/devices` | 在线/离线 CubeCat 设备及固件能力 |
| GET | `/devices/:deviceId/lua-runs` | 当前账号在设备上的 Lua 执行记录 |
| GET | `/devices/:deviceId/lua-runs/:runId/logs?after=0` | 执行日志 |
| POST | `/devices/:deviceId/lua-runs/:runId/stop` | 停止排队或运行中的任务 |

设备与 API 网关之间使用 `/api/device-ws/v1` WebSocket；iOS 客户端只消费已鉴权的 HTTP
管理接口，不保存设备密钥。
