import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { BuildingAiMcpService, JsonSchemaObject, McpToolDescriptor } from "../types.js";

const stubOutputSchema: JsonSchemaObject = {
    type: "object",
    properties: {
        ok: { type: "boolean", description: "Always false while this tool is a stub." },
        notImplemented: { type: "boolean", description: "Whether the tool is only a placeholder." },
        tool: { type: "string", description: "The MCP tool name." },
        message: { type: "string", description: "Human-readable placeholder message." },
        receivedArgs: { type: "object", description: "Arguments received by the stub." },
    },
    required: ["ok", "notImplemented", "tool", "message", "receivedArgs"],
    additionalProperties: false,
};

function createStubResult(
    tool: string,
    title: string,
    args: Record<string, unknown>,
): CallToolResult {
    const message = `Stub only: ${title} is not implemented. No hardware operation was performed.`;

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
    description: "Device session ID returned by open_serial.",
};

const timeoutProperty = {
    type: "number",
    description: "Operation timeout in milliseconds.",
};

export const embeddedService: BuildingAiMcpService = {
    key: "embedded",
    name: "Embedded Device Blocks",
    description:
        "Placeholder block-style tools for embedded development: serial, board control, GPIO, ADC, PWM, I2C, and logging.",
    tools: [
        tool({
            name: "scan_serial_ports",
            title: "Scan Serial Ports",
            description:
                "List available serial ports for selecting a development board connection.",
            inputSchema: {
                type: "object",
                properties: {
                    includeBusy: {
                        type: "boolean",
                        description: "Whether to include ports that appear to be busy.",
                    },
                },
                additionalProperties: false,
            },
        }),
        tool({
            name: "open_serial",
            title: "Open Serial",
            description: "Open a serial device session for later blocks.",
            inputSchema: {
                type: "object",
                properties: {
                    port: { type: "string", description: "Serial port path or name." },
                    baudRate: { type: "number", description: "Serial baud rate." },
                    dataBits: { type: "number", description: "Data bits, usually 8." },
                    stopBits: { type: "number", description: "Stop bits, usually 1." },
                    parity: {
                        type: "string",
                        description: "Parity mode: none, even, odd, mark, or space.",
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["port", "baudRate"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "close_device",
            title: "Close Device",
            description: "Close an opened device session and release its resources.",
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
            title: "Reset Device",
            description: "Reset the connected board using the selected reset strategy.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    strategy: {
                        type: "string",
                        description: "Reset strategy: dtr, rts, bootloader, command, or probe.",
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "get_device_info",
            title: "Get Device Info",
            description: "Read board identity, firmware version, and declared capabilities.",
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
            title: "Flash Firmware",
            description: "Placeholder for flashing firmware to a board.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    firmwarePath: { type: "string", description: "Path to the firmware artifact." },
                    target: { type: "string", description: "Target board or chip identifier." },
                    verify: { type: "boolean", description: "Whether to verify after flashing." },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "firmwarePath"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "serial_write_text",
            title: "Serial Write Text",
            description: "Send text to the serial device.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    text: { type: "string", description: "Text to send." },
                    lineEnding: {
                        type: "string",
                        description: "Line ending to append: none, lf, crlf, or cr.",
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "text"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "serial_write_bytes",
            title: "Serial Write Bytes",
            description: "Send raw bytes to the serial device.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    bytes: {
                        type: "array",
                        items: { type: "number" },
                        description: "Byte values from 0 to 255.",
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "bytes"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "serial_read_line",
            title: "Serial Read Line",
            description: "Read a single line from the serial device.",
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
            title: "Serial Expect Text",
            description: "Wait until serial output contains expected text.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    text: { type: "string", description: "Expected text fragment." },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "text"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "serial_request_response",
            title: "Serial Request Response",
            description: "Send a serial command and wait for a response.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    command: { type: "string", description: "Command to send." },
                    expect: {
                        type: "string",
                        description: "Optional expected response fragment.",
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "command"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "gpio_set_mode",
            title: "GPIO Set Mode",
            description: "Configure a GPIO pin mode.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", description: "Board pin name or number." },
                    mode: {
                        type: "string",
                        description:
                            "Pin mode: input, output, input_pullup, input_pulldown, analog, or pwm.",
                    },
                },
                required: ["sessionId", "pin", "mode"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "gpio_write",
            title: "GPIO Write",
            description: "Set a digital output pin high or low.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", description: "Board pin name or number." },
                    value: { type: "boolean", description: "High when true, low when false." },
                },
                required: ["sessionId", "pin", "value"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "gpio_read",
            title: "GPIO Read",
            description: "Read a digital input pin.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", description: "Board pin name or number." },
                },
                required: ["sessionId", "pin"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "analog_read",
            title: "Analog Read",
            description: "Read an analog input or ADC channel.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", description: "Analog pin name or ADC channel." },
                    referenceVoltage: {
                        type: "number",
                        description: "Reference voltage used for conversion.",
                    },
                },
                required: ["sessionId", "pin"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "pwm_write",
            title: "PWM Write",
            description: "Set PWM frequency and duty cycle for a pin.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", description: "PWM-capable pin." },
                    dutyCycle: {
                        type: "number",
                        description: "Duty cycle from 0 to 1.",
                    },
                    frequencyHz: {
                        type: "number",
                        description: "PWM frequency in hertz.",
                    },
                },
                required: ["sessionId", "pin", "dutyCycle"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "servo_write_angle",
            title: "Servo Write Angle",
            description: "Set a hobby servo angle.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    pin: { type: "string", description: "Servo signal pin." },
                    angle: { type: "number", description: "Target angle in degrees." },
                },
                required: ["sessionId", "pin", "angle"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "i2c_scan",
            title: "I2C Scan",
            description: "Scan the I2C bus for connected device addresses.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    bus: { type: "string", description: "I2C bus identifier." },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "i2c_write_register",
            title: "I2C Write Register",
            description: "Write bytes to an I2C device register.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    address: { type: "number", description: "7-bit I2C device address." },
                    register: { type: "number", description: "Register address." },
                    data: {
                        type: "array",
                        items: { type: "number" },
                        description: "Byte values to write.",
                    },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "address", "register", "data"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "i2c_read_register",
            title: "I2C Read Register",
            description: "Read bytes from an I2C device register.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    address: { type: "number", description: "7-bit I2C device address." },
                    register: { type: "number", description: "Register address." },
                    length: { type: "number", description: "Number of bytes to read." },
                    timeoutMs: timeoutProperty,
                },
                required: ["sessionId", "address", "register", "length"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "delay_ms",
            title: "Delay Milliseconds",
            description: "Placeholder for a block-level delay.",
            inputSchema: {
                type: "object",
                properties: {
                    durationMs: { type: "number", description: "Delay duration in milliseconds." },
                },
                required: ["durationMs"],
                additionalProperties: false,
            },
        }),
        tool({
            name: "save_serial_log",
            title: "Save Serial Log",
            description: "Save collected serial logs to a file or artifact.",
            inputSchema: {
                type: "object",
                properties: {
                    sessionId: sessionProperty,
                    path: { type: "string", description: "Destination log path." },
                    format: { type: "string", description: "Log format: text, jsonl, or csv." },
                },
                required: ["sessionId", "path"],
                additionalProperties: false,
            },
        }),
    ],
};
