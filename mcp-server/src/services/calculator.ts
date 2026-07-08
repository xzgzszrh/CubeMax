import { getRequiredNumber } from "../args.js";
import type { BuildingAiMcpService } from "../types.js";

function createNumberResultText(a: number, operator: string, b: number, result: number): string {
    return `${a} ${operator} ${b} = ${result}`;
}

export const calculatorService: BuildingAiMcpService = {
    key: "calculator",
    name: "Calculator",
    description: "Basic deterministic calculation tools.",
    tools: [
        {
            name: "add",
            title: "Add",
            description: "Add two numbers.",
            inputSchema: {
                type: "object",
                properties: {
                    a: { type: "number", description: "First number." },
                    b: { type: "number", description: "Second number." },
                },
                required: ["a", "b"],
                additionalProperties: false,
            },
            outputSchema: {
                type: "object",
                properties: {
                    result: { type: "number" },
                    text: { type: "string" },
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
            title: "Multiply",
            description: "Multiply two numbers.",
            inputSchema: {
                type: "object",
                properties: {
                    a: { type: "number", description: "First number." },
                    b: { type: "number", description: "Second number." },
                },
                required: ["a", "b"],
                additionalProperties: false,
            },
            outputSchema: {
                type: "object",
                properties: {
                    result: { type: "number" },
                    text: { type: "string" },
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
