import type { BuildingAiMcpService } from "../mcp-hub.types";
import { getOptionalString, getRequiredString } from "../utils/tool-args.util";

export const textService: BuildingAiMcpService = {
    key: "text",
    name: "文本处理",
    description: "提供常用的文本转换与检查工具。",
    tools: [
        {
            name: "echo",
            title: "回显文本",
            description: "返回输入的文本，可选添加前缀。",
            inputSchema: {
                type: "object",
                properties: {
                    message: { type: "string", title: "文本", description: "要返回的文本。" },
                    prefix: { type: "string", title: "前缀", description: "可选的文本前缀。" },
                },
                required: ["message"],
                additionalProperties: false,
            },
            outputSchema: {
                type: "object",
                properties: {
                    text: { type: "string", title: "返回文本" },
                },
                required: ["text"],
                additionalProperties: false,
            },
            async execute(args) {
                const message = getRequiredString(args, "message");
                const prefix = getOptionalString(args, "prefix");
                const text = `${prefix ? `${prefix}: ` : ""}${message}`;

                return {
                    content: [{ type: "text", text }],
                    structuredContent: { text },
                };
            },
        },
        {
            name: "countCharacters",
            title: "统计字符数",
            description: "统计文本中的 Unicode 字符数量。",
            inputSchema: {
                type: "object",
                properties: {
                    text: { type: "string", title: "文本", description: "要统计字符数的文本。" },
                },
                required: ["text"],
                additionalProperties: false,
            },
            outputSchema: {
                type: "object",
                properties: {
                    count: { type: "number", title: "字符数" },
                    text: { type: "string", title: "统计结果" },
                },
                required: ["count", "text"],
                additionalProperties: false,
            },
            async execute(args) {
                const text = getRequiredString(args, "text");
                const count = Array.from(text).length;
                const summary = `共 ${count} 个字符`;

                return {
                    content: [{ type: "text", text: summary }],
                    structuredContent: { count, text: summary },
                };
            },
        },
    ],
};
