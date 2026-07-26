/**
 * 内置 MCP Hub 的类型定义
 *
 * 从独立进程 mcp-server 移植而来（原 mcp-server/src/types.ts）。
 * 不再依赖 @modelcontextprotocol/sdk，工具返回值类型按 MCP 协议手写等价定义。
 */

export type JsonSchemaObject = {
    type: "object";
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
    additionalProperties?: boolean;
};

/**
 * MCP tools/call 返回内容块（当前内置工具只使用文本内容）
 */
export type McpToolResultContent = { type: "text"; text: string };

/**
 * MCP tools/call 返回结果（对应协议中的 CallToolResult）
 */
export type McpToolCallResult = {
    content: McpToolResultContent[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
};

export type McpToolDescriptor = {
    name: string;
    title: string;
    description: string;
    inputSchema: JsonSchemaObject;
    outputSchema?: JsonSchemaObject;
    execute: (args: Record<string, unknown>) => Promise<McpToolCallResult> | McpToolCallResult;
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

/**
 * JSON-RPC 2.0 消息 ID
 */
export type JsonRpcId = string | number | null;

/**
 * MCP streamable HTTP 端点对单条 POST 请求的处理结果
 */
export type McpHttpResult = {
    status: number;
    body?: unknown;
};
