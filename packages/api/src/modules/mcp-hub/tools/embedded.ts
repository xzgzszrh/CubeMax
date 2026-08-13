import type { SimulatorService } from "../../simulator/simulator.service";
import type {
    BuildingAiMcpService,
    JsonSchemaObject,
    McpToolCallResult,
    McpToolDescriptor,
} from "../mcp-hub.types";

const stubOutputSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        ok: { type: "boolean", title: "执行成功", description: "占位工具固定返回 false。" },
        notImplemented: {
            type: "boolean",
            title: "尚未实现",
            description: "工具是否仅为占位实现。",
        },
        tool: { type: "string", title: "工具名称", description: "MCP 工具的协议名称。" },
        message: { type: "string", title: "提示信息", description: "供用户阅读的占位提示。" },
        receivedArgs: { type: "object", title: "接收参数", description: "占位工具接收到的参数。" },
    },
    required: ["ok", "notImplemented", "tool", "message", "receivedArgs"],
    additionalProperties: false,
};

function createStubResult(
    tool: string,
    title: string,
    args: Record<string, unknown>,
): McpToolCallResult {
    const message = `“${title}”目前仅为占位工具，尚未执行任何硬件操作。`;

    return {
        content: [{ type: "text", text: message }],
        structuredContent: {
            ok: false,
            notImplemented: true,
            tool,
            message,
            receivedArgs: args,
        },
    };
}

function tool(config: Omit<McpToolDescriptor, "outputSchema" | "execute">): McpToolDescriptor {
    return {
        ...config,
        outputSchema: stubOutputSchema,
        async execute(args) {
            return createStubResult(config.name, config.title, args);
        },
    };
}

const sessionProperty = {
    type: "string",
    title: "会话 ID",
    description: "打开串口后返回的设备会话 ID。",
};

const timeoutProperty = {
    type: "number",
    title: "超时（毫秒）",
    description: "操作超时时间，单位为毫秒。",
};

export const embeddedService: BuildingAiMcpService = {
    key: "embedded",
    name: "嵌入式设备工具",
    description: "面向嵌入式开发的积木式工具，涵盖串口、开发板控制、GPIO、ADC、PWM、I2C 和日志。",
    tools: [
        tool({
            name: "scan_serial_ports",
            title: "扫描串口",
            description: "列出可用串口，用于选择开发板连接。",
            inputSchema: {
                type: "object",
                properties: {
                    includeBusy: {
                        type: "boolean",
                        title: "包含占用端口",
                        description: "是否包含看起来正在被占用的串口。",
                    },
                },
                additionalProperties: false,
            },
        }),
        tool({
            name: "open_serial",
            title: "打开串口",
            description: "打开串口设备会话，供后续工具使用。",
            inputSchema: {
                type: "object",
                properties: {
                    port: { type: "string", title: "端口", description: "串口路径或名称。" },
                    baudRate: { type: "number", title: "波特率", description: "串口通信波特率。" },
                    dataBits: {
                        type: "number",
                        title: "数据位",
                        description: "串口数据位，通常为 8。",
                    },
                    stopBits: {
                        type: "number",
                        title: "停止位",
                        description: "串口停止位，通常为 1。",
                    },
                    parity: {
                        type: "string",
                        title: "校验位",
                        description: "串口校验模式。",
                        enum: ["none", "even", "odd", "mark", "space"],
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["port", "baudRate"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "close_device",
            title: "关闭设备",
            description: "关闭已打开的设备会话并释放资源。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                },
                required: ["sessionId"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "reset_device",
            title: "复位设备",
            description: "按选择的复位策略重置已连接的开发板。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    strategy: {
                        type: "string",
                        title: "复位策略",
                        description: "设备复位方式。",
                        enum: ["dtr", "rts", "bootloader", "command", "probe"],
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "get_device_info",
            title: "读取设备信息",
            description: "读取开发板标识、固件版本和能力信息。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "flash_firmware",
            title: "烧录固件",
            description: "向开发板烧录固件的占位工具。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    firmwarePath: {
                        type: "string",
                        title: "固件路径",
                        description: "固件产物的文件路径。",
                    },
                    target: {
                        type: "string",
                        title: "目标",
                        description: "目标开发板或芯片标识。",
                    },
                    verify: {
                        type: "boolean",
                        title: "烧录后校验",
                        description: "是否在烧录后进行校验。",
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "firmwarePath"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "serial_write_text",
            title: "串口写文本",
            description: "向串口设备发送文本。",
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
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "text"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "serial_write_bytes",
            title: "串口写字节",
            description: "向串口设备发送原始字节。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    bytes: {
                        type: "array",
                        title: "字节",
                        items: { type: "number" },
                        description: "0 到 255 之间的字节值。",
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "bytes"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "serial_read_line",
            title: "串口读一行",
            description: "从串口设备读取一行数据。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "serial_expect_text",
            title: "等待串口文本",
            description: "等待串口输出中出现指定文本。",
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
        }),
        tool({
            name: "serial_request_response",
            title: "串口请求响应",
            description: "发送串口命令并等待响应。",
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
        }),
        tool({
            name: "gpio_set_mode",
            title: "GPIO 设置模式",
            description: "配置 GPIO 引脚模式。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", title: "引脚", description: "开发板引脚名称或编号。" },
                    mode: {
                        type: "string",
                        title: "模式",
                        description: "引脚工作模式。",
                        enum: [
                            "input",
                            "output",
                            "input_pullup",
                            "input_pulldown",
                            "analog",
                            "pwm",
                        ],
                    },
                },
                required: ["sessionId", "pin", "mode"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "gpio_write",
            title: "GPIO 写入",
            description: "设置数字输出引脚为高电平或低电平。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", title: "引脚", description: "开发板引脚名称或编号。" },
                    value: {
                        type: "boolean",
                        title: "电平",
                        description: "是表示高电平，否表示低电平。",
                    },
                },
                required: ["sessionId", "pin", "value"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "gpio_read",
            title: "GPIO 读取",
            description: "读取数字输入引脚状态。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", title: "引脚", description: "开发板引脚名称或编号。" },
                },
                required: ["sessionId", "pin"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "analog_read",
            title: "模拟量读取",
            description: "读取模拟输入或 ADC 通道。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: {
                        type: "string",
                        title: "引脚",
                        description: "模拟引脚名称或 ADC 通道。",
                    },
                    referenceVoltage: {
                        type: "number",
                        title: "参考电压",
                        description: "用于换算的参考电压。",
                    },
                },
                required: ["sessionId", "pin"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "pwm_write",
            title: "PWM 输出",
            description: "设置引脚的 PWM 频率和占空比。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", title: "引脚", description: "支持 PWM 的引脚。" },
                    dutyCycle: {
                        type: "number",
                        title: "占空比",
                        description: "0 到 1 之间的占空比。",
                    },
                    frequencyHz: {
                        type: "number",
                        title: "频率（Hz）",
                        description: "PWM 频率，单位为赫兹。",
                    },
                },
                required: ["sessionId", "pin", "dutyCycle"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "servo_write_angle",
            title: "设置舵机角度",
            description: "设置舵机的目标角度。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", title: "引脚", description: "舵机信号引脚。" },
                    angle: { type: "number", title: "角度", description: "目标角度，单位为度。" },
                },
                required: ["sessionId", "pin", "angle"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "i2c_scan",
            title: "I2C 扫描",
            description: "扫描 I2C 总线上已连接设备的地址。",
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
        }),
        tool({
            name: "i2c_write_register",
            title: "I2C 写寄存器",
            description: "向 I2C 设备寄存器写入字节。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    address: { type: "number", title: "地址", description: "7 位 I2C 设备地址。" },
                    register: { type: "number", title: "寄存器", description: "寄存器地址。" },
                    data: {
                        type: "array",
                        title: "数据",
                        items: { type: "number" },
                        description: "要写入的字节值。",
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "address", "register", "data"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "i2c_read_register",
            title: "I2C 读寄存器",
            description: "从 I2C 设备寄存器读取字节。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    address: { type: "number", title: "地址", description: "7 位 I2C 设备地址。" },
                    register: { type: "number", title: "寄存器", description: "寄存器地址。" },
                    length: { type: "number", title: "读取长度", description: "要读取的字节数。" },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "address", "register", "length"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "delay_ms",
            title: "延时",
            description: "用于流程级延时的占位工具。",
            inputSchema: {
                type: "object",
                properties: {
                    durationMs: {
                        type: "number",
                        title: "时长（毫秒）",
                        description: "延时时长，单位为毫秒。",
                    },
                },
                required: ["durationMs"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "save_serial_log",
            title: "保存串口日志",
            description: "将收集到的串口日志保存到文件或产物。",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    path: { type: "string", title: "路径", description: "日志保存目标路径。" },
                    format: {
                        type: "string",
                        title: "格式",
                        description: "日志保存格式。",
                        enum: ["text", "jsonl", "csv"],
                    },
                },
                required: ["sessionId", "path"],
                additionalProperties: false,
            },
        }),
    ],
};

export function createEmbeddedService(simulatorService: SimulatorService): BuildingAiMcpService {
    return {
        ...embeddedService,
        description: "面向虚拟 ESP32 的积木式工具，支持 GPIO、ADC、PWM、舵机、I2C 和串口仿真。",
        tools: embeddedService.tools.map((descriptor) => ({
            ...descriptor,
            outputSchema: undefined,
            async execute(args) {
                if (descriptor.name === "scan_serial_ports") {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "虚拟设备请从硬件仿真页面创建并复制会话 ID。",
                            },
                        ],
                        structuredContent: { ports: [] },
                    };
                }
                const output = await simulatorService.executeTool(descriptor.name, args);
                return {
                    content: [{ type: "text", text: JSON.stringify(output) }],
                    structuredContent: output,
                };
            },
        })),
    };
}
