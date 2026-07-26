import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

import type { CreateMcpClientOptions, McpClient, McpToolInfo } from "./types";

/**
 * 创建 MCP 客户端
 *
 * @param options 客户端创建选项
 * @returns MCP 客户端实例
 */
export async function createMcpClient(options: CreateMcpClientOptions): Promise<McpClient> {
    const { transport, name, version } = options;

    let mcpTransport: Parameters<typeof createMCPClient>[0]["transport"];

    switch (transport.type) {
        case "sse": {
            mcpTransport = {
                type: "sse" as const,
                url: transport.url,
                ...(transport.headers && { headers: transport.headers }),
            };
            break;
        }
        case "http": {
            mcpTransport = {
                type: "http" as const,
                url: transport.url,
                ...(transport.headers && { headers: transport.headers }),
            };
            break;
        }
        case "stdio": {
            mcpTransport = new Experimental_StdioMCPTransport({
                command: transport.command,
                args: transport.args,
                ...(transport.env && { env: transport.env }),
            });
            break;
        }
        case "custom": {
            mcpTransport = transport.transport as Parameters<
                typeof createMCPClient
            >[0]["transport"];
            break;
        }
        default: {
            const _exhaustive: never = transport;
            throw new Error(`Unsupported transport type: ${JSON.stringify(_exhaustive)}`);
        }
    }

    const client = await createMCPClient({
        transport: mcpTransport,
        ...(name && { name }),
        ...(version && { version }),
    });

    return {
        tools: async () => await client.tools(),
        listTools: async (): Promise<McpToolInfo[]> => {
            const result = await client.listTools();
            return result.tools.map((tool) => ({
                name: tool.name,
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
            }));
        },
        callTool: async (toolName: string, args: Record<string, unknown>): Promise<unknown> => {
            // AI SDK 的 MCP 客户端不直接暴露 tools/call；通过工具集里的
            // execute 触发同一条 JSON-RPC 调用。
            const toolSet = (await client.tools()) as unknown as Record<
                string,
                { execute?: (input: unknown, options: unknown) => Promise<unknown> }
            >;
            const tool = toolSet[toolName];
            if (!tool || typeof tool.execute !== "function") {
                throw new Error(`MCP 工具不存在: ${toolName}`);
            }
            return tool.execute(args, { toolCallId: toolName, messages: [] });
        },
        close: async () => await client.close(),
    };
}
