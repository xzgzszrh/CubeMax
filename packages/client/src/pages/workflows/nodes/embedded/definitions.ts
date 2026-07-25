/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { WorkflowNodeType } from "../constants";

export const EMBEDDED_MCP_SERVICE_KEY = "embedded";

export type EmbeddedNodePanelGroup =
  | "embedded-device"
  | "embedded-serial"
  | "embedded-gpio"
  | "embedded-analog-pwm"
  | "embedded-i2c"
  | "embedded-debug";

export type EmbeddedNodeDefinition = {
  type: WorkflowNodeType;
  action: string;
  title: string;
  label: string;
  description: string;
  group: EmbeddedNodePanelGroup;
  groupLabel: string;
  inputSchema: Record<string, unknown>;
};

const sessionProperty = {
  type: "string",
  title: "会话 ID",
  description: "打开串口后返回的设备会话 ID。",
};

const timeoutProperty = {
  type: "number",
  title: "超时(ms)",
  description: "操作超时时间，单位毫秒。",
  default: 1000,
};

export const EMBEDDED_NODE_DEFINITIONS: EmbeddedNodeDefinition[] = [
  {
    type: WorkflowNodeType.EmbeddedScanSerialPorts,
    action: "scan_serial_ports",
    title: "扫描串口",
    label: "扫描串口",
    description: "列出可用串口，用于选择开发板连接。",
    group: "embedded-device",
    groupLabel: "设备",
    inputSchema: {
      type: "object",
      properties: {
        includeBusy: {
          type: "boolean",
          title: "包含占用端口",
          description: "是否包含看起来正在被占用的串口。",
          default: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedOpenSerial,
    action: "open_serial",
    title: "打开串口",
    label: "打开串口",
    description: "打开串口设备会话，供后续节点使用。",
    group: "embedded-device",
    groupLabel: "设备",
    inputSchema: {
      type: "object",
      properties: {
        port: { type: "string", title: "端口", description: "串口路径或名称。" },
        baudRate: {
          type: "number",
          title: "波特率",
          description: "串口通信波特率。",
          default: 115200,
        },
        dataBits: { type: "number", title: "数据位", description: "串口数据位。", default: 8 },
        stopBits: { type: "number", title: "停止位", description: "串口停止位。", default: 1 },
        parity: {
          type: "string",
          title: "校验位",
          description: "串口校验模式。",
          enum: ["none", "even", "odd", "mark", "space"],
          extra: {
            enumLabels: {
              none: "无校验",
              even: "偶校验",
              odd: "奇校验",
              mark: "标记校验",
              space: "空格校验",
            },
          },
          default: "none",
        },
        timeoutMs: timeoutProperty,
      },
      required: ["port", "baudRate"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedCloseDevice,
    action: "close_device",
    title: "关闭设备",
    label: "关闭设备",
    description: "关闭已打开的设备会话并释放资源。",
    group: "embedded-device",
    groupLabel: "设备",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedResetDevice,
    action: "reset_device",
    title: "复位设备",
    label: "复位设备",
    description: "按选择的复位策略重置已连接开发板。",
    group: "embedded-device",
    groupLabel: "设备",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        strategy: {
          type: "string",
          title: "复位策略",
          description: "设备复位方式。",
          enum: ["dtr", "rts", "bootloader", "command", "probe"],
          extra: {
            enumLabels: {
              dtr: "DTR 信号",
              rts: "RTS 信号",
              bootloader: "进入引导程序",
              command: "发送复位命令",
              probe: "调试探针",
            },
          },
          default: "dtr",
        },
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedGetDeviceInfo,
    action: "get_device_info",
    title: "读取设备信息",
    label: "设备信息",
    description: "读取开发板标识、固件版本和能力信息。",
    group: "embedded-device",
    groupLabel: "设备",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedFlashFirmware,
    action: "flash_firmware",
    title: "烧录固件",
    label: "烧录固件",
    description: "用于向开发板烧录固件的占位节点。",
    group: "embedded-device",
    groupLabel: "设备",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        firmwarePath: {
          type: "string",
          title: "固件路径",
          description: "固件产物的文件路径。",
        },
        target: { type: "string", title: "目标", description: "目标开发板或芯片。" },
        verify: {
          type: "boolean",
          title: "烧录后校验",
          description: "是否在烧录后进行校验。",
          default: true,
        },
        timeoutMs: { ...timeoutProperty, default: 60000 },
      },
      required: ["sessionId", "firmwarePath"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedSerialWriteText,
    action: "serial_write_text",
    title: "串口写文本",
    label: "写文本",
    description: "向串口设备发送文本。",
    group: "embedded-serial",
    groupLabel: "串口",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        text: { type: "string", title: "文本", description: "要发送的文本。" },
        lineEnding: {
          type: "string",
          title: "行尾",
          description: "发送时追加的行尾字符。",
          enum: ["none", "lf", "crlf", "cr"],
          extra: {
            enumLabels: {
              none: "不追加",
              lf: "换行符（LF）",
              crlf: "回车换行（CRLF）",
              cr: "回车符（CR）",
            },
          },
          default: "lf",
        },
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId", "text"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedSerialWriteBytes,
    action: "serial_write_bytes",
    title: "串口写字节",
    label: "写字节",
    description: "向串口设备发送原始字节。",
    group: "embedded-serial",
    groupLabel: "串口",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        bytes: {
          type: "array",
          title: "字节",
          description: "0 到 255 之间的字节值。",
          items: { type: "number" },
          default: [],
        },
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId", "bytes"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedSerialReadLine,
    action: "serial_read_line",
    title: "串口读一行",
    label: "读一行",
    description: "从串口设备读取一行数据。",
    group: "embedded-serial",
    groupLabel: "串口",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedSerialExpectText,
    action: "serial_expect_text",
    title: "等待串口文本",
    label: "等待文本",
    description: "等待串口输出中出现指定文本。",
    group: "embedded-serial",
    groupLabel: "串口",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        text: { type: "string", title: "文本", description: "期望出现的文本片段。" },
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId", "text"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedSerialRequestResponse,
    action: "serial_request_response",
    title: "串口请求响应",
    label: "请求响应",
    description: "发送串口命令并等待响应。",
    group: "embedded-serial",
    groupLabel: "串口",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        command: { type: "string", title: "命令", description: "要发送的命令。" },
        expect: {
          type: "string",
          title: "期望响应",
          description: "可选的期望响应片段。",
        },
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId", "command"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedGpioSetMode,
    action: "gpio_set_mode",
    title: "GPIO 设置模式",
    label: "设置引脚模式",
    description: "配置 GPIO 引脚模式。",
    group: "embedded-gpio",
    groupLabel: "GPIO",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        pin: { type: "string", title: "引脚", description: "开发板引脚名称或编号。" },
        mode: {
          type: "string",
          title: "模式",
          description: "引脚工作模式。",
          enum: ["input", "output", "input_pullup", "input_pulldown", "analog", "pwm"],
          extra: {
            enumLabels: {
              input: "输入",
              output: "输出",
              input_pullup: "上拉输入",
              input_pulldown: "下拉输入",
              analog: "模拟输入",
              pwm: "PWM 输出",
            },
          },
          default: "output",
        },
      },
      required: ["sessionId", "pin", "mode"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedGpioWrite,
    action: "gpio_write",
    title: "GPIO 写入",
    label: "写引脚",
    description: "设置数字输出引脚为高电平或低电平。",
    group: "embedded-gpio",
    groupLabel: "GPIO",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        pin: { type: "string", title: "引脚", description: "开发板引脚名称或编号。" },
        value: {
          type: "boolean",
          title: "电平",
          description: "true 表示高电平，false 表示低电平。",
          default: false,
        },
      },
      required: ["sessionId", "pin", "value"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedGpioRead,
    action: "gpio_read",
    title: "GPIO 读取",
    label: "读引脚",
    description: "读取数字输入引脚状态。",
    group: "embedded-gpio",
    groupLabel: "GPIO",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        pin: { type: "string", title: "引脚", description: "开发板引脚名称或编号。" },
      },
      required: ["sessionId", "pin"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedAnalogRead,
    action: "analog_read",
    title: "模拟量读取",
    label: "模拟读取",
    description: "读取模拟输入或 ADC 通道。",
    group: "embedded-analog-pwm",
    groupLabel: "模拟/PWM",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        pin: { type: "string", title: "引脚", description: "模拟引脚名称或 ADC 通道。" },
        referenceVoltage: {
          type: "number",
          title: "参考电压",
          description: "用于换算的参考电压。",
          default: 3.3,
        },
      },
      required: ["sessionId", "pin"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedPwmWrite,
    action: "pwm_write",
    title: "PWM 输出",
    label: "PWM 输出",
    description: "设置引脚的 PWM 频率和占空比。",
    group: "embedded-analog-pwm",
    groupLabel: "模拟/PWM",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        pin: { type: "string", title: "引脚", description: "支持 PWM 的引脚。" },
        dutyCycle: {
          type: "number",
          title: "占空比",
          description: "0 到 1 之间的占空比。",
          default: 0.5,
        },
        frequencyHz: {
          type: "number",
          title: "频率(Hz)",
          description: "PWM 频率，单位赫兹。",
          default: 1000,
        },
      },
      required: ["sessionId", "pin", "dutyCycle"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedServoWriteAngle,
    action: "servo_write_angle",
    title: "舵机角度",
    label: "舵机角度",
    description: "设置舵机目标角度。",
    group: "embedded-analog-pwm",
    groupLabel: "模拟/PWM",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        pin: { type: "string", title: "引脚", description: "舵机信号引脚。" },
        angle: {
          type: "number",
          title: "角度",
          description: "目标角度，单位度。",
          default: 90,
        },
      },
      required: ["sessionId", "pin", "angle"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedI2cScan,
    action: "i2c_scan",
    title: "I2C 扫描",
    label: "I2C 扫描",
    description: "扫描 I2C 总线上已连接设备的地址。",
    group: "embedded-i2c",
    groupLabel: "I2C",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        bus: { type: "string", title: "总线", description: "I2C 总线标识。" },
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedI2cWriteRegister,
    action: "i2c_write_register",
    title: "I2C 写寄存器",
    label: "I2C 写入",
    description: "向 I2C 设备寄存器写入字节。",
    group: "embedded-i2c",
    groupLabel: "I2C",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        address: { type: "number", title: "地址", description: "7 位 I2C 设备地址。" },
        register: { type: "number", title: "寄存器", description: "寄存器地址。" },
        data: {
          type: "array",
          title: "数据",
          description: "要写入的字节值。",
          items: { type: "number" },
          default: [],
        },
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId", "address", "register", "data"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedI2cReadRegister,
    action: "i2c_read_register",
    title: "I2C 读寄存器",
    label: "I2C 读取",
    description: "从 I2C 设备寄存器读取字节。",
    group: "embedded-i2c",
    groupLabel: "I2C",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        address: { type: "number", title: "地址", description: "7 位 I2C 设备地址。" },
        register: { type: "number", title: "寄存器", description: "寄存器地址。" },
        length: {
          type: "number",
          title: "读取长度",
          description: "要读取的字节数。",
          default: 1,
        },
        timeoutMs: timeoutProperty,
      },
      required: ["sessionId", "address", "register", "length"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedDelayMs,
    action: "delay_ms",
    title: "延时",
    label: "延时",
    description: "用于流程级延时的占位节点。",
    group: "embedded-debug",
    groupLabel: "调试/测试",
    inputSchema: {
      type: "object",
      properties: {
        durationMs: {
          type: "number",
          title: "时长(ms)",
          description: "延时时长，单位毫秒。",
          default: 1000,
        },
      },
      required: ["durationMs"],
      additionalProperties: false,
    },
  },
  {
    type: WorkflowNodeType.EmbeddedSaveSerialLog,
    action: "save_serial_log",
    title: "保存串口日志",
    label: "保存日志",
    description: "将收集到的串口日志保存到文件或产物。",
    group: "embedded-debug",
    groupLabel: "调试/测试",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: sessionProperty,
        path: { type: "string", title: "路径", description: "日志保存目标路径。" },
        format: {
          type: "string",
          title: "格式",
          description: "日志格式。",
          enum: ["text", "jsonl", "csv"],
          extra: {
            enumLabels: {
              text: "纯文本",
              jsonl: "JSON Lines",
              csv: "CSV",
            },
          },
          default: "text",
        },
      },
      required: ["sessionId", "path"],
      additionalProperties: false,
    },
  },
];
