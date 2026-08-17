import { createMcpClient, type McpClient } from "@buildingai/ai-sdk";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    AiMcpServer,
    AiMcpTool,
    AiUserMcpServer,
    McpCommunicationType,
    McpServerType,
    ProgrammingProjectTool,
    type ProgrammingProjectPublishedSnapshot,
} from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { BuiltinMcpRegistryService } from "@modules/ai/mcp/services/builtin-mcp-registry.service";
import { Injectable } from "@nestjs/common";
import Ajv from "ajv";

type ResolvedMcpTarget = {
    url: string;
    communicationType: McpCommunicationType;
    headers?: Record<string, string>;
    name: string;
    inputSchema?: Record<string, unknown>;
};

type WorkflowMcpNodeData = {
    mcpServerId?: string;
    toolName?: string;
    timeoutMs?: number;
    failOnToolError?: boolean;
};

export type WorkflowMcpExecutorInput = {
    userId?: string;
    runtimeContext?: {
        projectId?: string;
        publishedSnapshot?: unknown;
    };
    node: {
        id: string;
        type: string;
        data?: WorkflowMcpNodeData;
    };
    inputs: Record<string, unknown>;
};

type AiSdkTool = {
    execute?: (
        args: Record<string, unknown>,
        options?: { abortSignal?: AbortSignal },
    ) => Promise<unknown>;
};

@Injectable()
export class WorkflowMcpExecutorService {
    private readonly ajv = new Ajv({ allErrors: true, strict: false });

    constructor(
        @InjectRepository(AiMcpServer)
        private readonly mcpServerRepository: Repository<AiMcpServer>,
        @InjectRepository(AiMcpTool)
        private readonly mcpToolRepository: Repository<AiMcpTool>,
        @InjectRepository(AiUserMcpServer)
        private readonly userMcpServerRepository: Repository<AiUserMcpServer>,
        @InjectRepository(ProgrammingProjectTool)
        private readonly projectToolRepository: Repository<ProgrammingProjectTool>,
        private readonly builtinMcpRegistryService: BuiltinMcpRegistryService,
    ) {}

    async execute(input: WorkflowMcpExecutorInput) {
        const { userId, node, inputs } = input;
        const {
            mcpServerId,
            toolName,
            timeoutMs = 60000,
            failOnToolError = true,
        } = node.data ?? {};

        if (!userId) {
            throw new Error("MCP node requires an authenticated user");
        }
        if (!mcpServerId) {
            throw new Error("MCP server is required");
        }
        if (!toolName) {
            throw new Error("MCP tool is required");
        }

        await this.assertProjectToolAccess(input, mcpServerId, toolName);

        const target = await this.resolveTarget(mcpServerId, toolName, userId);

        this.validateInputs(target.inputSchema, inputs);

        let client: McpClient | null = null;
        try {
            client = await createMcpClient({
                transport: {
                    type: target.communicationType === McpCommunicationType.SSE ? "sse" : "http",
                    url: target.url,
                    ...(target.headers ? { headers: target.headers } : {}),
                },
                name: target.name,
            });

            const tools = await client.tools();
            const tool = tools[toolName] as AiSdkTool | undefined;
            if (!tool?.execute) {
                throw new Error(`MCP tool "${toolName}" is not executable`);
            }

            const rawResult = await this.executeWithTimeout(tool, inputs, timeoutMs);
            const outputs = this.normalizeResult(rawResult);

            if (failOnToolError && outputs.isError) {
                throw new Error(outputs.text || `MCP tool "${toolName}" returned an error`);
            }

            return outputs;
        } finally {
            if (client) {
                await client.close().catch(() => undefined);
            }
        }
    }

    private async assertProjectToolAccess(
        input: WorkflowMcpExecutorInput,
        mcpServerId: string,
        toolName: string,
    ): Promise<void> {
        if (this.isEmbeddedBuiltinTool(mcpServerId)) return;
        const snapshot = input.runtimeContext?.publishedSnapshot;
        if (this.isPublishedSnapshot(snapshot)) {
            const allowed = snapshot.tools.some(
                (tool) => tool.mcpServerId === mcpServerId && tool.toolName === toolName,
            );
            if (!allowed) throw new Error(`MCP tool "${toolName}" is not included in published project`);
            return;
        }
        if (!input.runtimeContext?.projectId) return;
        const enabled = await this.projectToolRepository.findOne({
            where: { projectId: input.runtimeContext.projectId, mcpServerId, toolName },
        });
        if (!enabled) throw new Error(`MCP tool "${toolName}" is not enabled for this project`);
    }

    private isEmbeddedBuiltinTool(mcpServerId: string): boolean {
        return this.builtinMcpRegistryService.getServer(mcpServerId)?.key === "embedded";
    }

    private isPublishedSnapshot(value: unknown): value is ProgrammingProjectPublishedSnapshot {
        return (
            !!value &&
            typeof value === "object" &&
            (value as ProgrammingProjectPublishedSnapshot).version === 1 &&
            Array.isArray((value as ProgrammingProjectPublishedSnapshot).tools)
        );
    }

    /**
     * 解析 MCP 目标（连接信息 + 工具参数 schema）
     *
     * 内置（动态嗅探）MCP 走内存注册表，其余走数据库。
     */
    private async resolveTarget(
        mcpServerId: string,
        toolName: string,
        userId: string,
    ): Promise<ResolvedMcpTarget> {
        if (this.builtinMcpRegistryService.isBuiltinId(mcpServerId)) {
            return this.resolveBuiltinTarget(mcpServerId, toolName);
        }

        const server = await this.getAccessibleServer(mcpServerId, userId);
        const toolRecord = await this.getToolRecord(mcpServerId, toolName);

        return {
            url: server.url,
            communicationType: server.communicationType,
            headers: server.headers,
            name: server.name,
            inputSchema: toolRecord.inputSchema,
        };
    }

    private resolveBuiltinTarget(mcpServerId: string, toolName: string): ResolvedMcpTarget {
        const server = this.builtinMcpRegistryService.getServer(mcpServerId);
        if (!server) {
            throw new Error("MCP server does not exist");
        }
        if (!server.connectable) {
            throw new Error("MCP server is disabled or not connectable");
        }

        const tool = this.builtinMcpRegistryService.getTool(mcpServerId, toolName);
        if (!tool) {
            throw new Error(`MCP tool "${toolName}" does not exist`);
        }

        return {
            url: server.url,
            communicationType: server.communicationType,
            headers: server.headers,
            name: server.name,
            inputSchema: tool.inputSchema,
        };
    }

    private async getAccessibleServer(mcpServerId: string, userId: string): Promise<AiMcpServer> {
        const server = await this.mcpServerRepository.findOne({
            where: { id: mcpServerId },
        });

        if (!server) {
            throw new Error("MCP server does not exist");
        }
        if (!server.url || !server.communicationType) {
            throw new Error("MCP server is missing connection configuration");
        }
        if (server.isDisabled || !server.connectable) {
            throw new Error("MCP server is disabled or not connectable");
        }

        if (server.type === McpServerType.USER) {
            if (server.creatorId !== userId) {
                throw new Error("MCP server does not exist");
            }
            return server;
        }

        const userSetting = await this.userMcpServerRepository.findOne({
            where: {
                userId,
                mcpServerId,
            },
        });

        if (userSetting?.isDisabled) {
            throw new Error("MCP server is disabled for current user");
        }

        return server;
    }

    private async getToolRecord(mcpServerId: string, toolName: string): Promise<AiMcpTool> {
        const toolRecord = await this.mcpToolRepository.findOne({
            where: {
                mcpServerId,
                name: toolName,
            },
        });

        if (!toolRecord) {
            throw new Error(`MCP tool "${toolName}" does not exist`);
        }

        return toolRecord;
    }

    private validateInputs(inputSchema: Record<string, unknown> | undefined, inputs: unknown) {
        const schema = inputSchema && Object.keys(inputSchema).length > 0 ? inputSchema : {};
        const validate = this.ajv.compile(schema);

        if (validate(inputs)) {
            return;
        }

        const message = this.ajv.errorsText(validate.errors, { separator: "; " });
        throw new Error(`MCP tool input validation failed: ${message}`);
    }

    private async executeWithTimeout(
        tool: AiSdkTool,
        inputs: Record<string, unknown>,
        timeoutMs: number,
    ): Promise<unknown> {
        const abortController = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;

        try {
            return await Promise.race([
                tool.execute!(inputs, { abortSignal: abortController.signal }),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        abortController.abort();
                        reject(new Error(`MCP tool execution timed out after ${timeoutMs}ms`));
                    }, timeoutMs);
                }),
            ]);
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }

    private normalizeResult(rawResult: unknown) {
        const resultObject = this.isRecord(rawResult) ? rawResult : { result: rawResult };
        const content = Array.isArray(resultObject.content) ? resultObject.content : [];
        const result =
            "structuredContent" in resultObject
                ? resultObject.structuredContent
                : "toolResult" in resultObject
                  ? resultObject.toolResult
                  : rawResult;
        const text = this.extractText(content, result);

        return {
            text,
            result,
            content,
            isError: resultObject.isError === true,
        };
    }

    private extractText(content: unknown[], result: unknown): string {
        const textParts = content
            .map((part) => {
                if (this.isRecord(part) && part.type === "text" && typeof part.text === "string") {
                    return part.text;
                }
                return undefined;
            })
            .filter((part): part is string => !!part);

        if (textParts.length > 0) {
            return textParts.join("\n");
        }
        if (typeof result === "string") {
            return result;
        }
        if (result === undefined || result === null) {
            return "";
        }

        try {
            return JSON.stringify(result);
        } catch {
            return String(result);
        }
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === "object" && !Array.isArray(value);
    }
}
