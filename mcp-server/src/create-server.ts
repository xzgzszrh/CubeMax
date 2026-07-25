import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import type { BuildingAiMcpService } from "./types.js";

export function createServiceMcpServer(service: BuildingAiMcpService): Server {
    const server = new Server(
        {
            name: `buildingai-${service.key}`,
            version: "0.0.1",
        },
        {
            capabilities: {
                tools: {},
            },
        },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: service.tools.map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
        })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const tool = service.tools.find((item) => item.name === request.params.name);
        if (!tool) {
            return {
                content: [
                    {
                        type: "text",
                        text: `未找到工具“${request.params.name}”`,
                    },
                ],
                isError: true,
            };
        }

        try {
            return await tool.execute(request.params.arguments ?? {});
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: message }],
                isError: true,
            };
        }
    });

    return server;
}
