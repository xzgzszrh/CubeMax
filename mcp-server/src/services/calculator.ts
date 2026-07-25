import { getRequiredNumber } from "../args.js";
import type { BuildingAiMcpService } from "../types.js";

function createNumberResultText(a: number, operator: string, b: number, result: number): string {
    return `${a} ${operator} ${b} = ${result}`;
}

export const calculatorService: BuildingAiMcpService = {
    key: "calculator",
    name: "计算器",
    description: "提供结果确定的基础数学计算工具。",
    tools: [
        {
            name: "add",
            title: "加法",
            description: "计算两个数的和。",
            inputSchema: {
                type: "object",
                properties: {
                    a: { type: "number", title: "第一个数", description: "参与相加的第一个数。" },
                    b: { type: "number", title: "第二个数", description: "参与相加的第二个数。" },
                },
                required: ["a", "b"],
                additionalProperties: false,
            },
            outputSchema: {
                type: "object",
                properties: {
                    result: { type: "number", title: "计算结果" },
                    text: { type: "string", title: "结果文本" },
                },
                required: ["result", "text"],
                additionalProperties: false,
            },
            async execute(args) {
                const a = getRequiredNumber(args, "a");
                const b = getRequiredNumber(args, "b");
                const result = a + b;
                const text = createNumberResultText(a, "+", b, result);

                return {
                    content: [{ type: "text", text }],
                    structuredContent: { result, text },
                };
            },
        },
        {
            name: "multiply",
            title: "乘法",
            description: "计算两个数的乘积。",
            inputSchema: {
                type: "object",
                properties: {
                    a: { type: "number", title: "第一个数", description: "参与相乘的第一个数。" },
                    b: { type: "number", title: "第二个数", description: "参与相乘的第二个数。" },
                },
                required: ["a", "b"],
                additionalProperties: false,
            },
            outputSchema: {
                type: "object",
                properties: {
                    result: { type: "number", title: "计算结果" },
                    text: { type: "string", title: "结果文本" },
                },
                required: ["result", "text"],
                additionalProperties: false,
            },
            async execute(args) {
                const a = getRequiredNumber(args, "a");
                const b = getRequiredNumber(args, "b");
                const result = a * b;
                const text = createNumberResultText(a, "*", b, result);

                return {
                    content: [{ type: "text", text }],
                    structuredContent: { result, text },
                };
            },
        },
    ],
};
