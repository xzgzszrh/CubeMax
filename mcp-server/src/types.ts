import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type JsonSchemaObject = {
    type: "object";
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
    additionalProperties?: boolean;
};

export type McpToolDescriptor = {
    name: string;
    title: string;
    description: string;
    inputSchema: JsonSchemaObject;
    outputSchema?: JsonSchemaObject;
    execute: (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult;
};

export type BuildingAiMcpService = {
    key: string;
    name: string;
    description: string;
    tools: McpToolDescriptor[];
};

export type McpServiceCatalogItem = {
    key: string;
    name: string;
    description: string;
    url: string;
    tools: Array<Pick<McpToolDescriptor, "name" | "title" | "description">>;
};
