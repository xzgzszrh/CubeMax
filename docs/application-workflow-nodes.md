# 应用工作流节点 API 文档

## 概述

应用工作流是面向设备编程的图形化编程系统，类似于 Arduino，但使用 AI 进行语音交互和设备控制。系统通过 xiaozhi.me 提供语音服务，工作流通过修改智能体提示词和 MCP 通信来实现与设备的交互。

## 节点类型

### 1. Agent 节点（智能体）

**类型**: `agent`

**功能**: 切换 xiaozhi.me 设备的智能体提示词

**数据字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agentId | string | 是 | 目标智能体 ID |
| action | string | 是 | 操作类型: `switch_prompt`, `enable`, `disable` |
| prompt | string | 条件 | 当 action 为 `switch_prompt` 时必填 |
| promptName | string | 否 | 提示词名称（用于显示） |

**示例**:
```json
{
  "type": "agent",
  "data": {
    "agentId": "agent_xxx",
    "action": "switch_prompt",
    "prompt": "你是一个智能语音助手，用户请求计时时，请调用 MCP 工具 timer_complete",
    "promptName": "计时助手"
  }
}
```

**后端接口**:
```
PATCH /api/xiaozhi/agents/{agentId}/config
Body: { systemPrompt: string, promptName?: string }
```

---

### 2. Wait 节点（等待）

**类型**: `wait`

**功能**: 等待特定条件满足

**数据字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| waitType | string | 是 | 等待类型: `mcp_call`, `webhook`, `timeout`, `variable` |
| triggerId | string | 条件 | MCP 调用或 Webhook 触发时的触发器 ID |
| timeoutMs | number | 否 | 超时时间（毫秒），0 表示不超时 |
| expectedDataPath | string | 否 | 期望的数据路径，如 `data.result` |
| expectedValue | string | 否 | 期望的具体值 |

**示例**:
```json
{
  "type": "wait",
  "data": {
    "waitType": "mcp_call",
    "triggerId": "webhook_timer_xxx",
    "timeoutMs": 300000,
    "expectedDataPath": "data.status"
  }
}
```

**执行逻辑**:
- `mcp_call`: 等待指定 triggerId 的 MCP 调用返回
- `webhook`: 等待 Webhook 触发
- `timeout`: 等待指定时间后自动继续
- `variable`: 等待全局变量满足条件

---

### 3. Webhook 节点（回传端点）

**类型**: `webhook`

**功能**: 定义可被 xiaozhi.me 调用的 MCP 端点，用于接收回传数据

**数据字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| toolName | string | 是 | MCP 工具名称 |
| toolDescription | string | 否 | 工具描述 |
| inputSchema | object | 否 | 输入参数 JSON Schema |

**示例**:
```json
{
  "type": "webhook",
  "data": {
    "toolName": "timer_complete",
    "toolDescription": "计时完成回传",
    "inputSchema": {
      "type": "object",
      "properties": {
        "action": { "type": "string" },
        "data": {
          "type": "object",
          "properties": {
            "duration": { "type": "number" },
            "success": { "type": "boolean" }
          }
        }
      }
    }
  }
}
```

**后端接口**:
```
POST /api/webhook/{nodeId}
Body: { action: string, data: object }
```

---

### 4. Vision 节点（视觉识别）

**类型**: `vision`

**功能**: 拍摄照片并交给 AI 分析

**数据字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | string | 是 | CubeCat 设备 ID |
| captureMode | string | 否 | 拍摄模式: `photo`(单张), `continuous`(连续), `stream`(视频流) |
| analysisPrompt | string | 否 | AI 分析提示词 |
| modelId | string | 否 | 视觉模型 ID |
| saveImage | boolean | 否 | 是否保存图片 |

**输出字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否成功 |
| imageUrl | string | 图片 URL |
| analysisResult | string | AI 分析结果 |
| detectedObjects | array | 检测到的对象 |

**示例**:
```json
{
  "type": "vision",
  "data": {
    "deviceId": "device_xxx",
    "captureMode": "photo",
    "analysisPrompt": "识别图片中的人物数量和动作",
    "modelId": "qwen-vl-max"
  }
}
```

---

### 5. Speech 节点（语音播报）

**类型**: `speech`

**功能**: 通过 xiaozhi.me 设备播放语音

**数据字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agentId | string | 是 | 目标智能体 ID |
| text | string | 是 | 播报内容 |
| mode | string | 否 | 播报模式: `speak`(立即), `queue`(排队) |
| modelId | string | 否 | TTS 模型 ID |
| speed | number | 否 | 语速 (0.5-2.0) |
| volume | number | 否 | 音量 (0-1) |
| waitForComplete | boolean | 否 | 是否等待播报完成 |

**示例**:
```json
{
  "type": "speech",
  "data": {
    "agentId": "agent_xxx",
    "text": "计时完毕，灯已打开",
    "mode": "speak",
    "speed": 1.0,
    "waitForComplete": true
  }
}
```

**后端接口**:
```
POST /api/xiaozhi/agents/{agentId}/speech
Body: { text: string, voice?: string, speed?: number, volume?: number }
```

---

### 6. DeviceControl 节点（设备控制）

**类型**: `device_control`

**功能**: 直接控制 CubeCat 设备的硬件输出

**数据字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | string | 是 | 设备 ID |
| action | string | 是 | 控制动作 |

**LED 控制 (led_toggle)**:
| ledIndex | number | LED 编号 |
| ledState | boolean | true=亮, false=灭 |

**LED RGB (led_rgb)**:
| ledIndex | number | LED 编号 |
| ledColor | string | RGB 颜色值 |

**蜂鸣器 (buzzer)**:
| buzzerFrequency | number | 频率 (Hz) |
| buzzerDurationMs | number | 持续时间 (ms) |

**电机 (motor)**:
| motorIndex | number | 电机编号 |
| motorSpeed | number | 速度 (%) |
| motorDirection | string | `forward`(正转), `reverse`(反转), `stop`(停止) |

**示例**:
```json
{
  "type": "device_control",
  "data": {
    "deviceId": "device_xxx",
    "action": "led_toggle",
    "ledIndex": 0,
    "ledState": true
  }
}
```

---

## 示例工作流：计时器应用

```
开始
  ↓
Agent: 切换到"计时助手"提示词
  ↓
Wait: 等待 webhook 触发（timer_complete）
  ↓
Lua: 显示时钟界面（传入5分钟）
  ↓
Agent: 切换到"计时进行中"提示词
  ↓
Wait: 超时 5 分钟
  ↓
Speech: 播报"计时完毕"
  ↓
DeviceControl: 打开灯
  ↓
Lua: 提示操作成功
  ↓
Agent: 恢复到默认提示词
```

---

## 硬件接口说明

### MCP 端点注册

发布应用工程时，系统会自动为每个 Webhook 节点注册 MCP 端点：

```
POST /api/xiaozhi/agents/{agentId}/mcp/register
Body: {
  toolName: string,
  description: string,
  inputSchema: object,
  callbackUrl: string
}
```

### 设备控制协议

设备通过 WebSocket 与服务器通信：

```
// 发送命令到设备
{ "type": "control", "deviceId": "xxx", "action": "led_toggle", "params": {...} }

// 设备响应
{ "type": "control_result", "success": true, "data": {...} }
```

### 视觉获取协议

```
// 请求设备拍摄
{ "type": "capture", "deviceId": "xxx", "mode": "photo" }

// 设备返回
{ "type": "capture_result", "success": true, "imageUrl": "..." }
```
