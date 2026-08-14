# CubeMax ESP32 Lua WebSocket 协议 v1

## 1. 目标与边界

本协议用于让 ESP32 主动连接 CubeMax 服务器。用户在 Web 端点击“发送并运行”后，服务器将当前 Lua 源码快照和参数可靠地下发到指定 ESP32，由设备执行并回传状态、日志和结果。

浏览器不直连 ESP32，也不把用户 JWT 交给设备。浏览器沿用当前登录态调用 HTTP API；服务器负责设备鉴权、用户授权、任务排队、可靠投递和状态持久化。

设备通道采用原生 RFC 6455 WebSocket，不使用 Socket.IO。生产环境只允许 TLS：

~~~text
wss://<host>/api/device-ws/v1
~~~

连接 URL 不携带密钥。设备在 WebSocket 升级完成后通过服务端随机挑战完成认证。生产环境应拒绝明文 ws 连接。

本文定义的协议版本为 1。新增可选字段属于向后兼容；修改必填字段、字段类型或现有消息语义时，必须升级主版本并使用新的 URL 路径。

## 2. 总体架构

~~~mermaid
sequenceDiagram
  participant Web as CubeMax Web
  participant API as CubeMax API / Device Gateway
  participant ESP as ESP32
  ESP->>API: WebSocket Upgrade
  API->>ESP: hello.challenge
  ESP->>API: hello（HMAC + 能力）
  API->>ESP: hello.welcome
  Web->>API: POST 创建 Lua 运行任务（用户 JWT）
  API->>ESP: run.prepare -> run.chunk* -> run.commit
  ESP-->>API: ready / chunk.ack / accepted / log / finished
  API-->>Web: HTTP 查询或 SSE 返回状态和日志
~~~

服务器职责：

- 注册设备、配对、吊销和授权。xiaozhi-esp32 使用固件首次启动时生成并持久化的 Board UUID 作为 device_id；设备必须绑定用户或组织，只有具备操作权限的用户才能下发任务。
- 下发前持久化运行任务。服务重启后不能丢失已排队的源码、参数和投递状态。
- 校验 UTF-8 和大小，计算 SHA-256，并根据设备声明的限制分片和限速。
- 将全部设备消息视为不可信输入，逐字段校验，并把设备事件映射为 Web 可查询的运行状态。
- 每个 device_id 只保留一个有效连接。新连接认证成功后替换旧连接。

ESP32 职责：

- 维持出站 WebSocket 连接，断线后按退避策略重连。
- 使用独立设备密钥认证；上报能力；在同一次固件启动内保留传输进度；校验分片和完整文件；在 NVS 中保留最近终态，保证已提交的同一 run_id 不会重复执行。
- 只执行通过已认证连接接收的源码，不能相信 Lua 源码或参数中出现的任意 device_id。

## 3. 编码与限制

所有应用消息均为“一条 UTF-8 JSON 文本 WebSocket 消息”。v1 不使用 WebSocket Binary Frame。字段名使用小写 snake_case；协议枚举值和错误码使用 ASCII；时间使用带毫秒的 UTC RFC 3339 字符串。

服务端默认限制如下；设备上报更小限制时取两者最小值：

| 项目 | 限制 |
| --- | ---: |
| Lua 源码 UTF-8 字节数 | 65,536 字节 |
| params 序列化 JSON | 4,096 字节 |
| run.chunk.data_b64 解码后大小 | 1,024 字节 |
| 单条应用层 JSON 消息 | 24,576 字节 |
| 单个任务同时未确认的分片 | 1 个 |
| 单条持久化日志 | 1,024 UTF-8 字节 |
| Web 可请求运行超时 | 1,000 至 60,000 ms |

data_b64 使用 RFC 4648 标准 Base64，保留 = 补位。必须按 UTF-8 原始字节分片，不能按 JavaScript 字符或 Lua 字符分片，否则中文可能损坏。

sha256 是对完整原始字节计算的 64 位小写十六进制字符串。crc32 是对单个分片解码后的原始字节计算的 IEEE CRC-32（多项式 0xEDB88320）八位小写十六进制字符串。

设备在 hello 中上报真实限制。服务器必须使用 min(服务器限制, 设备限制)，无法满足时在投递前失败。设备在分配内存前就应拒绝超限消息。

## 4. 通用消息信封

每条应用消息结构如下：

~~~json
{
  "v": 1,
  "type": "run.prepare",
  "id": "018f02a4-441c-7f3f-8a74-c82101911a90",
  "ts": "2026-08-14T10:00:00.123Z",
  "data": {}
}
~~~

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| v | 是 | 整数协议版本；v1 只接受 1。 |
| type | 是 | 本文定义的消息类型。 |
| id | 是 | 发送方生成的 UUID；同一连接内至少 24 小时不重复。 |
| ts | 是 | 发送方时间，仅用于诊断，不能用于鉴权。 |
| data | 是 | 对应 type 的对象载荷。 |
| reply_to | 否 | 本消息直接响应的消息 id。 |

接收方必须忽略未知的顶层字段和 data 字段，以支持兼容升级。缺少必填字段、类型错误、非法 JSON 或不支持的版本应返回 error；无法恢复时随后关闭连接。

run_id 由服务器生成；device_id 采用 xiaozhi-esp32 已有的持久化 Board UUID，并在服务器注册/配对；boot_id 和每条设备上行消息的 id 由设备生成。任何一方都不能仅凭 ID 格式判断权限。

消息类型总表：

| type | 方向 | 作用 |
| --- | --- | --- |
| hello.challenge | 服务器 -> 设备 | 认证随机挑战 |
| hello | 设备 -> 服务器 | 身份证明、能力和恢复状态 |
| hello.welcome | 服务器 -> 设备 | 认证成功及协商参数 |
| device.status | 设备 -> 服务器 | 心跳、资源和任务状态 |
| run.prepare | 服务器 -> 设备 | 声明待传源码和运行参数 |
| run.ready | 设备 -> 服务器 | 接受/恢复传输 |
| run.chunk | 服务器 -> 设备 | 源码字节分片 |
| run.chunk.ack | 设备 -> 服务器 | 分片已持久化 |
| run.commit | 服务器 -> 设备 | 完整校验并请求执行 |
| run.accepted | 设备 -> 服务器 | Lua 运行时已接受任务 |
| run.log | 设备 -> 服务器 | 运行日志 |
| run.stop | 服务器 -> 设备 | 停止运行或取消传输 |
| run.stopping | 设备 -> 服务器 | 已接受停止请求 |
| run.finished | 设备 -> 服务器 | 唯一逻辑终态 |
| run.finished.ack | 服务器 -> 设备 | 终态已持久化 |
| error | 双向 | 协议或命令错误 |

## 5. 连接、认证与存活

WebSocket 建立后，服务器立即发送一个密码学安全的随机 32 字节挑战。设备必须在 10 秒内发送 hello；服务器应关闭超时未认证的连接。

### 5.1 服务器到设备：hello.challenge

~~~json
{
  "v": 1,
  "type": "hello.challenge",
  "id": "9df11643-2284-4c72-8bfc-4f57074b3ce1",
  "ts": "2026-08-14T10:00:00.000Z",
  "data": {
    "nonce_b64": "mP7sZx4PYpYNpQbAlyQ2mMdM9yAFNHN9mq4aG9o7PSw=",
    "auth_deadline_ms": 10000,
    "server_time": "2026-08-14T10:00:00.000Z"
  }
}
~~~

### 5.2 设备到服务器：hello

~~~json
{
  "v": 1,
  "type": "hello",
  "id": "c0911b82-c930-48f9-8593-075c0a44c79d",
  "reply_to": "9df11643-2284-4c72-8bfc-4f57074b3ce1",
  "ts": "2026-08-14T10:00:01.242Z",
  "data": {
    "device_id": "a2a494dc-4e76-4b8f-8c7f-439d42087edb",
    "key_id": "v1",
    "boot_id": "9b3e1fc4-b605-4edf-9ba3-677e4f77ce16",
    "firmware_version": "1.0.0",
    "lua_runtime": "esp-claw-0.1.0",
    "proof_b64": "<base64 HMAC-SHA256>",
    "limits": {
      "max_script_bytes": 65536,
      "max_params_bytes": 4096,
      "max_chunk_bytes": 1024,
      "max_message_bytes": 24576,
      "max_log_bytes": 1024
    },
    "capabilities": ["lua", "xiaozhi"],
    "runtime": {
      "execution_model": "main_once",
      "api_version": "xiaozhi.v1",
      "transfer_storage": "ram",
      "max_run_timeout_ms": 60000
    },
    "runtime_state": {
      "active_run_id": null,
      "transfer": null,
      "last_terminal_run": null
    }
  }
}
~~~

proof_b64 的计算公式为：

~~~text
Base64(HMAC-SHA256(device_secret, canonical_input))
~~~

canonical_input 是下面的 UTF-8 字节串。其中 \n 表示恰好一个 LF 字节 0x0A；各字段必须按收到/发送的原始文本拼接，不做大小写转换：

~~~text
cubemax-device-ws-v1\n<nonce_b64>\n<device_id>\n<key_id>\n<boot_id>\n<firmware_version>
~~~

为避免规范化歧义，device_id 和 boot_id 必须是小写规范 UUID；key_id 只允许 1 至 16 个 ASCII 字母、数字、点、下划线或短横线；firmware_version 只允许 1 至 32 个 ASCII 字母、数字、点、加号或短横线。上述字段均禁止空白和换行。

双方实现必须通过以下 HMAC 测试向量：

~~~text
device_secret_hex =
000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f

canonical_input =
cubemax-device-ws-v1\nmP7sZx4PYpYNpQbAlyQ2mMdM9yAFNHN9mq4aG9o7PSw=\na2a494dc-4e76-4b8f-8c7f-439d42087edb\nv1\n9b3e1fc4-b605-4edf-9ba3-677e4f77ce16\n1.0.0

expected_hmac_sha256_hex =
accd42fdaf0931d1d94149b9a6ad7d7a445584804ce6f2dea63dada618e2101f

expected_proof_b64 =
rM1C/a8JMdHZQUm5pq19ekRVhIBM5vLepj2tphjiEB8=
~~~

设备初始化时获得独立、随机的 32 字节 device_secret。服务器使用项目密钥管理能力加密保存；ESP32 存入受保护 NVS，建议同时启用 Flash Encryption。禁止使用平台 JWT_SECRET、全设备共享密码或 URL 查询参数中的 API Key。

服务器必须恒定时间比较 HMAC，对 IP 和 device_id 限速，并拒绝已吊销或未配对设备。boot_id 在固件每次启动时重新生成，用于判断传输是否被设备重启打断；它不是凭据。

### 5.3 服务器到设备：hello.welcome

~~~json
{
  "v": 1,
  "type": "hello.welcome",
  "id": "e5c6c770-ccf8-42d4-b8bd-11fc6973e0f5",
  "reply_to": "c0911b82-c930-48f9-8593-075c0a44c79d",
  "ts": "2026-08-14T10:00:01.294Z",
  "data": {
    "connection_id": "4ac10b37-9fe4-441f-bc87-2bd1ab3f79a0",
    "heartbeat_interval_ms": 20000,
    "server_limits": {
      "max_script_bytes": 65536,
      "max_params_bytes": 4096,
      "max_chunk_bytes": 1024,
      "max_message_bytes": 24576
    }
  }
}
~~~

只有收到 hello.welcome 后设备才进入在线状态；此前不能处理 run.* 消息。

服务器每 25 秒发送 RFC 6455 Ping 控制帧，10 秒内无 Pong 就关闭连接。设备另需至少每 20 秒发送一次 device.status，并在状态变化时立即发送。

断线重连间隔依次为 1、2、4、8、16、30 秒，之后封顶 30 秒，并增加正负 20% 随机抖动。明确的 AUTH_FAILED、DEVICE_REVOKED 或版本不支持不能无限重试，必须等待重新配置或固件升级。

### 5.4 设备到服务器：device.status

~~~json
{
  "v": 1,
  "type": "device.status",
  "id": "7ee55c6a-c9b1-4c8c-b9f8-e10342b8d833",
  "ts": "2026-08-14T10:00:21.000Z",
  "data": {
    "state": "idle",
    "uptime_ms": 30122,
    "free_heap_bytes": 148312,
    "rssi_dbm": -58,
    "active_run_id": null,
    "transfer": null
  }
}
~~~

state 取值为 idle、receiving、running 或 error。存在未完成传输时，transfer 为：

~~~json
{
  "run_id": "...",
  "sha256": "...",
  "next_chunk_index": 12,
  "received_bytes": 12288,
  "total_chunks": 64
}
~~~

设备在 boot_id 未改变的重连后，服务器根据 transfer 恢复同一任务。当前 xiaozhi-esp32 分区表没有独立 Lua 脚本分区，因此 transfer_storage 为 ram：设备重启后临时源码消失，hello 中 transfer 为 null，服务器使用同一 run_id 从第 0 片重传。若该 run_id 已经提交/运行过，则设备依据 NVS 中最近终态返回已有状态，绝不能再次执行。若服务端已不存在或已取消该 run_id，则发送 run.stop，设备删除临时缓冲并确认取消。

## 6. Web API 与服务端状态

浏览器只调用 HTTP API，由服务器生成全局唯一 run_id 并下发 run.* 消息。建议接口如下：

~~~text
GET  /api/devices
POST /api/devices/:deviceId/lua-runs
GET  /api/devices/:deviceId/lua-runs/:runId
GET  /api/devices/:deviceId/lua-runs/:runId/logs?after=<sequence>
POST /api/devices/:deviceId/lua-runs/:runId/stop
~~~

创建任务请求体是源码快照，而不是让设备稍后查询的模块引用：

~~~json
{
  "name": "blink.lua",
  "module_id": "可选的 CubeMax Lua 模块 UUID",
  "source": "function main(params) device.gpio_write(2, true) end",
  "params": { "interval_ms": 500 },
  "required_capabilities": ["lua", "xiaozhi"],
  "timeout_ms": 10000,
  "run_mode": "replace"
}
~~~

source 必填，必须是合法 UTF-8 Lua 文本并定义 main(params)。module_id 仅用于关联历史记录，设备不认识该字段。required_capabilities 至少含 lua；服务器不能可靠地通过字符串扫描推导依赖，应该由模块元数据或用户选择提供。未声明但运行时调用了不存在的 API 时，由 Lua 运行时返回失败。

run_mode v1 只定义 replace：设备可在旧任务运行期间接收新源码，但只有新源码完整校验并可被运行时接受后，才停止旧任务并替换。一个设备同时只能存在一个源码传输。

服务器返回 202 Accepted：

~~~json
{
  "code": 20000,
  "message": "ok",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "status": "queued"
  },
  "timestamp": 1786672860000
}
~~~

该结构沿用项目现有 TransformInterceptor 响应信封，HTTP 状态码为 202。WebSocket write 成功不代表投递或运行成功。服务端状态机如下：

| 服务端状态 | 进入条件 | 是否终态 |
| --- | --- | --- |
| queued | HTTP 请求已持久化，等待调度 | 否 |
| waiting_for_device | 设备离线或投递中断 | 否 |
| preparing | 已发送 run.prepare | 否 |
| transferring | 收到 run.ready，正在分片 | 否 |
| verifying | 已发送 run.commit | 否 |
| running | 收到 run.accepted | 否 |
| succeeded | 收到 run.finished: succeeded | 是 |
| failed | 收到 run.finished: failed | 是 |
| stopped | 收到 run.finished: stopped | 是 |
| timed_out | 收到 run.finished: timed_out | 是 |
| delivery_timeout | 超过投递截止时间仍未被设备接受 | 是 |
| unknown_after_disconnect | 运行设备失联且超过结果等待期 | 是 |

下发 run.prepare 前，服务器必须持久化源码原始字节或对象存储位置、源码 SHA-256、规范化参数 JSON、请求用户、设备、模块关联和全部截止时间。之后编辑或发布 Lua 模块不能改变已排队或历史任务。

## 7. Lua 任务投递

### 7.1 服务器到设备：run.prepare

~~~json
{
  "v": 1,
  "type": "run.prepare",
  "id": "ee127808-4594-479f-b26b-ae76707c7676",
  "ts": "2026-08-14T10:01:00.000Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "script": {
      "name": "blink.lua",
      "encoding": "utf-8/base64-chunks",
      "byte_length": 52,
      "sha256": "f4137362592d28e0d312bc50de86e81ecebf7f44c8089bc147fe0f76284ae56b",
      "chunk_bytes": 1024,
      "total_chunks": 1
    },
    "params": { "interval_ms": 500 },
    "params_sha256": "1165469f28122d6b4baa1863e5149e089972e78f080429a106209fe02d061f9a",
    "required_capabilities": ["lua", "xiaozhi"],
    "entry": "main",
    "timeout_ms": 10000,
    "run_mode": "replace"
  }
}
~~~

total_chunks = ceil(byte_length / chunk_bytes)。params_sha256 对服务器持久化的紧凑 UTF-8 JSON 字节计算；设备将服务端给出的值用于幂等比对，不需要重新序列化 params 计算摘要。

设备校验大小、能力、状态和参数后，创建或恢复 run_id.tmp，再回复：

~~~json
{
  "v": 1,
  "type": "run.ready",
  "id": "b8d10706-0189-4068-9d59-ba7d4f7f65ec",
  "reply_to": "ee127808-4594-479f-b26b-ae76707c7676",
  "ts": "2026-08-14T10:01:00.100Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "next_chunk_index": 0,
    "received_bytes": 0
  }
}
~~~

同一 run_id、源码 SHA-256、参数 SHA-256 和 entry 的重复 run.prepare 必须返回当前持久化进度，不能重新执行。相同 run_id 内容不同则返回 RUN_ID_CONFLICT。replace 模式下已有 Lua 任务不妨碍准备新传输；已有另一传输时返回 DEVICE_BUSY。

### 7.2 服务器到设备：run.chunk

服务器每次只发送一个分片，收到确认后再发下一个：

~~~json
{
  "v": 1,
  "type": "run.chunk",
  "id": "54809222-e42d-49c4-9bc0-1a7858cf5fa8",
  "ts": "2026-08-14T10:01:00.120Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "index": 0,
    "total_chunks": 1,
    "offset": 0,
    "data_b64": "ZnVuY3Rpb24gbWFpbihwYXJhbXMpIGRldmljZS5ncGlvX3dyaXRlKDIsIHRydWUpIGVuZA==",
    "crc32": "72512877"
  }
}
~~~

设备按以下顺序处理：

1. 校验信封、run_id、index 和大小，再分配解码缓冲区。
2. Base64 解码并验证 CRC-32。
3. 验证 offset == index * chunk_bytes；最后一片允许小于 chunk_bytes。
4. 只追加当前 next_chunk_index 对应的分片；当前固件写入有界 PSRAM 缓冲区后回复确认。该确认仅在同一次 boot 内有效。

~~~json
{
  "v": 1,
  "type": "run.chunk.ack",
  "id": "e9aa710c-3067-41bb-9042-7961b5952499",
  "reply_to": "54809222-e42d-49c4-9bc0-1a7858cf5fa8",
  "ts": "2026-08-14T10:01:00.150Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "index": 0,
    "next_chunk_index": 1,
    "received_bytes": 52
  }
}
~~~

收到已持久化的重复分片时，设备返回当前 next_chunk_index；收到未来分片则返回 OUT_OF_ORDER_CHUNK。

服务器等待确认 5 秒，最多重发同一逻辑分片三次。仍未确认时将任务置为 waiting_for_device，重连后沿用同一 run_id 恢复，不能为重试创建新 run_id。

### 7.3 服务器到设备：run.commit

全部分片确认后，服务器请求完整校验并执行：

~~~json
{
  "v": 1,
  "type": "run.commit",
  "id": "39bc9bdd-0ca0-4b29-b0e0-8b4731b73d8e",
  "ts": "2026-08-14T10:01:00.170Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "byte_length": 52,
    "sha256": "f4137362592d28e0d312bc50de86e81ecebf7f44c8089bc147fe0f76284ae56b"
  }
}
~~~

设备验证最终字节数和 SHA-256，通过后原子地把临时源码提升为待运行槽位，持久化 run_id 和摘要，再让 Lua 运行时加载源码。只有运行时已接受任务后才回复 run.accepted：

~~~json
{
  "v": 1,
  "type": "run.accepted",
  "id": "934f262a-b3b6-4429-918c-8cfdfd9ae3ca",
  "reply_to": "39bc9bdd-0ca0-4b29-b0e0-8b4731b73d8e",
  "ts": "2026-08-14T10:01:00.290Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "state": "running",
    "started_at": "2026-08-14T10:01:00.289Z"
  }
}
~~~

timeout_ms 从 started_at 开始计算，不包含排队和文件传输时间。若源码无法编译/加载，设备不发送 run.accepted，直接发送 status 为 failed、error.code 为 LUA_COMPILE_ERROR 的 run.finished。

Lua 结束时，设备发送终态：

~~~json
{
  "v": 1,
  "type": "run.finished",
  "id": "ee8f7931-f817-4660-a222-ecf79e1ab116",
  "ts": "2026-08-14T10:01:10.291Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "status": "succeeded",
    "duration_ms": 10002,
    "result": { "ok": true },
    "error": null
  }
}
~~~

status 只能是 succeeded、failed、stopped 或 timed_out。result 必须兼容 JSON 且不超过 16 KB。失败时 error 为：

~~~json
{
  "code": "LUA_RUNTIME_ERROR",
  "message": "attempt to call a nil value",
  "line": 12
}
~~~

不能上报设备密钥、完整源码或脚本外部的固件路径。

服务器持久化终态后回复：

~~~json
{
  "v": 1,
  "type": "run.finished.ack",
  "id": "8ef8eb9f-e29e-46f9-bdd7-af820766b3ad",
  "reply_to": "ee8f7931-f817-4660-a222-ecf79e1ab116",
  "ts": "2026-08-14T10:01:10.320Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737"
  }
}
~~~

设备在收到 ack 前保留最近终态，5 秒未确认或重连后应使用相同消息 id 重发 run.finished。服务器按 run_id 幂等保存，因此逻辑终态只有一个。重复 run.commit 必须返回已有 run.accepted 或 run.finished，绝不能再次执行。

### 7.4 日志

日志是异步的，可丢弃但不能阻塞控制消息。sequence 在每个 run_id 内从 1 单调递增，服务器按 (run_id, sequence) 去重：

~~~json
{
  "v": 1,
  "type": "run.log",
  "id": "a995fd14-93f0-4fc3-ba09-3a4a38826939",
  "ts": "2026-08-14T10:01:03.000Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "sequence": 4,
    "level": "info",
    "text": "GPIO 2 set to HIGH"
  }
}
~~~

level 为 debug、info、warn 或 error。设备最多每秒发送 20 条日志，超出时丢弃，并在下一条日志中说明丢弃数量。Lua print 输出应转为 run.log，不能伪装成 error 协议帧。

### 7.5 停止或取消

Web 调用 stop 接口后，服务器发送：

~~~json
{
  "v": 1,
  "type": "run.stop",
  "id": "fd75e52a-8ca3-4058-aa4f-95c40e2a66f2",
  "ts": "2026-08-14T10:01:05.000Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737",
    "reason": "user_request"
  }
}
~~~

- receiving 状态：删除对应临时文件，回复 run.stopping，然后发送 run.finished: stopped。
- running 状态：回复 run.stopping，在 Lua 安全中断点取消执行，然后发送 run.finished: stopped。
- 已是终态：重发已有 run.finished。
- run_id 不存在：返回 RUN_NOT_FOUND。

run.stopping 的结构如下；reply_to 指向对应 run.stop：

~~~json
{
  "v": 1,
  "type": "run.stopping",
  "id": "a7e36b76-ce21-4b89-b4f6-63e143c9cbdb",
  "reply_to": "fd75e52a-8ca3-4058-aa4f-95c40e2a66f2",
  "ts": "2026-08-14T10:01:05.020Z",
  "data": {
    "run_id": "ae64cf69-809f-4684-8ec3-bf42b1c13737"
  }
}
~~~

run.stop 可重复执行。服务端在收到 run.finished 前不能把 Web 状态乐观地标记为 stopped。

## 8. 错误、超时和关闭码

可恢复协议错误使用：

~~~json
{
  "v": 1,
  "type": "error",
  "id": "d6b36b2a-df4d-4cf0-82e8-a48e1fbefdd2",
  "reply_to": "ee127808-4594-479f-b26b-ae76707c7676",
  "ts": "2026-08-14T10:01:00.050Z",
  "data": {
    "code": "DEVICE_BUSY",
    "message": "another transfer is active",
    "retryable": true,
    "details": { "active_run_id": "..." }
  }
}
~~~

标准错误码：

| 错误码 | 含义 |
| --- | --- |
| BAD_ENVELOPE | JSON 或信封字段非法 |
| UNSUPPORTED_VERSION | 不支持协议版本 |
| AUTH_FAILED | 认证失败 |
| DEVICE_REVOKED | 设备已吊销 |
| DEVICE_BUSY | 存在另一个传输或不可替换任务 |
| UNSUPPORTED_CAPABILITY | 缺少任务声明的能力 |
| PAYLOAD_TOO_LARGE | 消息、源码、参数或结果超限 |
| INVALID_PARAMS | 参数不是合法 JSON 对象 |
| RUN_ID_CONFLICT | 相同 run_id 对应不同内容 |
| RUN_NOT_FOUND | 设备不存在该任务 |
| INVALID_CHUNK | Base64、索引、偏移或 CRC 错误 |
| OUT_OF_ORDER_CHUNK | 不是设备当前期待的分片 |
| HASH_MISMATCH | 最终 SHA-256 不一致 |
| STORAGE_ERROR | 临时或持久化存储失败 |
| LUA_COMPILE_ERROR | Lua 编译/加载失败 |
| LUA_RUNTIME_ERROR | Lua 运行失败 |
| EXECUTION_TIMEOUT | 超过 timeout_ms |

这些 code 同时用于 error.data.code 和 run.finished.data.error.code。协议解析、分片、存储或鉴权问题使用 error；Lua 编译、运行和超时属于任务结果，使用 run.finished。HASH_MISMATCH 时设备删除临时文件并返回 retryable: true，服务器最多用同一 run_id 从第 0 片完整重传一次；再次失败则将任务置为 failed。

WebSocket Close Code：

| Code | 含义 | 设备行为 |
| --- | --- | --- |
| 1000 | 服务正常关闭 | 按退避重连 |
| 1008 | 策略或认证违规 | 等待重新配网/配置，不持续重试 |
| 1009 | 消息过大 | 重连后降低消息或分片大小 |
| 1011 | 服务端内部错误 | 按退避重连 |
| 4001 | hello 超时 | 按退避重连并检查设备负载 |
| 4002 | 被更新的同设备连接替换 | 停止旧连接重试并记录告警 |
| 4003 | 设备已吊销 | 停止重试 |
| 4004 | 不支持协议版本 | 停止并等待固件升级 |

服务器在连接关闭后立即标记设备离线；连接存在但 45 秒未收到 device.status 时主动关闭。处于投递或运行中的任务先进入 waiting_for_device，而不是直接失败。

默认投递截止时间为 10 分钟，超时后置为 delivery_timeout。已收到 run.accepted 的任务失联后，等待至 started_at + timeout_ms + 10 秒；仍无可恢复的设备终态则置为 unknown_after_disconnect，绝不能标成成功。

## 9. Lua 运行时兼容契约

协议只负责传输源码，不翻译 Lua API。物理 xiaozhi-esp32 的远程任务入口为 main(params)，默认 capabilities 为 lua 和 xiaozhi，并提供 xiaozhi.v1 API：

~~~lua
xiaozhi.log(message)
xiaozhi.get_state()
xiaozhi.notify(message, duration_ms)
xiaozhi.set_emotion(emotion)
xiaozhi.start_listening()
xiaozhi.stop_listening()
~~~

当前 CubeMax 仿真器中的 device.gpio_*、board_manager、lvgl 等 API 不等于物理固件能力。服务器和 Web 必须根据目标设备 capabilities 选择/校验脚本；不能把仿真脚本默认视为物理设备可运行。将来某个板卡通过通用 Board 接口实现 gpio、adc、display 等能力后，才允许声明对应 capability 并增加相应 Lua binding。

run.prepare 声明了设备不支持的 required_capabilities 时，设备必须在执行前返回 UNSUPPORTED_CAPABILITY。

固件 Lua 运行时必须具备：

- timeout_ms 强制中断能力和独立 Lua 内存上限。
- 每次运行可重置的执行上下文，避免上一个脚本残留全局变量和任务。
- replace 原子切换：新源码校验或加载失败时保留旧的可运行版本；新任务接受后不得继续遗留旧任务。
- 捕获编译行号、运行错误和 JSON 兼容返回值的能力。

## 10. 设备初始化、配对与存储

设备初始化和配对通过管理员/用户 HTTP 接口完成，不走长期 WebSocket。

服务器使用设备上报的 Board UUID 注册 device_id，并生成 32 字节 device_secret 和 key_id。xiaozhi-esp32 的 OTA/激活响应可返回 lua_gateway 对象（url、device_id、key_id、secret_b64），固件通过现有 Settings 写入 lua_gateway NVS 命名空间。也可使用一次性短配对码把设备绑定到登录用户；配对码应在 10 分钟内过期、限制尝试次数，并且绝不能作为长期 WebSocket 密钥。

建议服务端持久化实体：

| 实体 | 关键字段 |
| --- | --- |
| physical_device | id、owner/organization、display_name、secret_ciphertext、key_id、revoked_at、last_seen_at、firmware_version、capabilities、limits |
| device_connection | device_id、connection_id、boot_id、connected_at、disconnected_at、close_code |
| lua_device_run | run_id、device_id、requester_id、module_id 可空、source/source_location、source_sha256、params、status、deadlines、result/error |
| lua_device_run_log | run_id、sequence、level、text、received_at |

device_secret 不能以明文进入日志、API 响应或数据库普通字段。支持轮换时，服务器可在短过渡期同时接受当前 key_id 和上一 key_id；设备确认新密钥后立即吊销旧密钥。

## 11. 双方实现边界

服务器端：

1. 在 Nest HTTP Server 上挂载 /api/device-ws/v1 原生 WebSocket Gateway；设备通道不要引入 Socket.IO。
2. 实现设备初始化/配对、HMAC 挑战认证、连接注册、心跳和单连接替换。
3. 增加物理设备与运行任务持久化、Web 鉴权接口、每设备串行投递状态机、日志和状态查询/SSE。
4. Web 增加在线物理设备选择和“发送并运行”；UI 展示服务端持久化状态，不展示乐观的 socket write 状态。
5. 当前 ecosystem.config.js 只有一个 API 实例，可以先使用进程内 device_id -> socket 注册表；扩展为多实例前，必须增加 Redis 连接归属/发布订阅或独立 Device Gateway，不能假定任意 API 进程都持有目标 socket。

ESP32 端：

1. 实现 CA 证书校验的 WSS、原生文本 JSON 帧、HMAC 挑战、Ping/Pong、重连退避和 device.status。
2. 使用有界 JSON/Base64 缓冲区；当前固件把分片写入有上限的 PSRAM 缓冲区，验证 CRC-32 和最终 SHA-256；不得占用或覆盖 assets 分区。将来增加专用 Lua 分区后可升级为跨重启续传。
3. 实现 run_id 幂等、停止/超时、main(params)、xiaozhi.v1 API、日志限流和可靠终态上报。

## 12. 联调验收用例

1. 已配对设备上线，Web API 能看到固件版本和限制；错误 HMAC 永远不能把设备标为在线。
2. 发送包含中文且恰好 64 KB 的 Lua 文件，设备所得字节与服务器快照完全一致，并且只运行一次。
3. 在第 n 个分片后断线且设备未重启，重连后从 next_chunk_index 续传；设备重启后使用同一 run_id 从第 0 片重传。
4. 重复发送 run.prepare、某个 run.chunk、run.commit 和 run.finished，最终仍只执行一次且服务端只有一个终态。
5. 对超限源码、非法 Base64、错误 CRC-32、错误 SHA-256 分别验证拒绝；先前可运行脚本不能被覆盖。
6. 停止一个无限循环脚本，依次看到 run.stopping、run.finished: stopped、run.finished.ack。
7. 设备运行时断网再恢复，服务端不能误报成功；设备持久化的终态可在重连后补报。
8. 吊销设备后，现有连接立即关闭，后续连接不能认证，排队任务不能继续下发。
