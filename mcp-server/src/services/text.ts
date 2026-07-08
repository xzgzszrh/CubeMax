import { getOptionalString, getRequiredString } from "../args.js";
import type { BuildingAiMcpService } from "../types.js";

export const textService: BuildingAiMcpService = {
    key: "text",
    name: "Text",
    description: "Small text transformation and inspection tools.",
    tools: [
        {
            name: "echo",
            title: "Echo",
            description: "Return a message with an optional prefix.",
            inputSchema: {
                type: "object",
                properties: {
                    message: { type: "string", description: "Text to return." },
                    prefix: { type: "string", description: "Optional prefix." },
                },
                required: ["message"],
                additionalProperties: false,
            },
            outputSchema: {
                type: "object",
                properties: {
                    text: { type: "string" },
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
            title: "Count Characters",
            description: "Count Unicode characters in a text value.",
            inputSchema: {
                type: "object",
                properties: {
                    text: { type: "string", description: "Text to count." },
                },
                required: ["text"],
                additionalProperties: false,
            },
            outputSchema: {
                type: "object",
                properties: {
                    count: { type: "number" },
                    text: { type: "string" },
                },
                required: ["count", "text"],
                additionalProperties: false,
            },
            async execute(args) {
                const text = getRequiredString(args, "text");
                const count = Array.from(text).length;
                const summary = `${count} characters`;

                return {
                    content: [{ type: "text", text: summary }],
                    structuredContent: { count, text: summary },
                };
            },
        },
    ],
};
