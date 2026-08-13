import { Injectable, Logger } from "@nestjs/common";

import { SimulatorService } from "../../simulator/simulator.service";
import type {
    BuildingAiMcpService,
    JsonRpcId,
    McpHttpResult,
    McpServiceCatalogItem,
    McpToolCallResult,
} from "../mcp-hub.types";
import { calculatorService } from "../tools/calculator";
import { createEmbeddedService } from "../tools/embedded";
import { tavilyService } from "../tools/tavily";
import { textService } from "../tools/text";

/**
 * 与 @ai-sdk/mcp 客户端一致的受支持协议版本列表。
 * initialize 时按客户端请求协商：请求的版本在列表内则原样返回，否则回落到最新版本。
 */
const LATEST_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION, "2025-03-26", "2024-11-05"];

const SERVER_VERSION = "0.0.1";

/**
 * 内置 MCP Hub 服务
 *
 * 由独立进程 mcp-server 合并而来：同一进程内提供服务目录（catalog）与
 * 每个内置 MCP 服务的无状态 streamable HTTP 端点。
 *
 * 协议实现为手写的最小无状态 JSON-RPC 处理器（不依赖 @modelcontextprotocol/sdk），
 * 支持 initialize / notifications/* / ping / tools/list / tools/call，
 * 响应始终为 application/json（无会话、无 SSE），与 @ai-sdk/mcp 的
 * HttpMCPTransport 客户端兼容（该客户端接受纯 JSON 响应，GET SSE 收到 405 时静默忽略）。
 */
@Injectable()
export class McpHubService {
    private readonly logger = new Logger(McpHubService.name);

    /** 已注册的内置 MCP 服务（Tavily 服务仅在配置了 TAVILY_API_KEY 时注册） */
    private services: BuildingAiMcpService[] | null = null;

    constructor(private readonly simulatorService: SimulatorService) {}

    private getServices(): BuildingAiMcpService[] {
        if (!this.services) {
            this.services = [
                calculatorService,
                textService,
                createEmbeddedService(this.simulatorService),
                ...(process.env.TAVILY_API_KEY ? [tavilyService] : []),
            ];
        }
        return this.services;
    }

    listServices(): BuildingAiMcpService[] {
        return this.getServices();
    }

    getService(key: string): BuildingAiMcpService | undefined {
        return this.getServices().find((service) => service.key === key);
    }

    getServiceKeys(): string[] {
        return this.getServices().map((service) => service.key);
    }

    /**
     * 生成服务目录（与原 mcp-server 的 GET /catalog 返回结构一致）
     *
     * @param baseUrl 本 hub 的对外基础地址（含 /api/mcp-hub 前缀，不含尾部斜杠）
     */
    createCatalog(baseUrl: string): McpServiceCatalogItem[] {
        const normalizedBase = baseUrl.replace(/\/+$/, "");
        return this.getServices().map((service) => ({
            key: service.key,
            name: service.name,
            description: service.description,
            url: `${normalizedBase}/mcp/${service.key}`,
            tools: service.tools.map((tool) => ({
                name: tool.name,
                title: tool.title,
                description: tool.description,
            })),
        }));
    }

    /**
     * 处理某个内置 MCP 服务的一次 streamable HTTP POST 请求（无状态模式）
     *
     * @param serviceKey 服务 key（catalog 中的 key）
     * @param payload 已解析的 JSON 请求体（单条 JSON-RPC 消息或消息数组）
     * @returns HTTP 状态码与 JSON 响应体（无响应体时表示 202 Accepted）
     */
    async handleMcpPost(serviceKey: string, payload: unknown): Promise<McpHttpResult> {
        const service = this.getService(serviceKey);
        if (!service) {
            return {
                status: 404,
                body: {
                    jsonrpc: "2.0",
                    error: { code: -32001, message: "未找到 MCP 服务" },
                    id: null,
                },
            };
        }

        // 批量消息：逐条处理，仅返回请求消息的响应（JSON-RPC batch 兼容）
        if (Array.isArray(payload)) {
            if (payload.length === 0) {
                return this.invalidRequest(null, "请求体不能为空数组");
            }
            const responses: unknown[] = [];
            for (const message of payload) {
                const result = await this.handleSingleMessage(service, message);
                if (result !== undefined) {
                    responses.push(result);
                }
            }
            if (responses.length === 0) {
                return { status: 202 };
            }
            return { status: 200, body: responses };
        }

        const response = await this.handleSingleMessage(service, payload);
        if (response === undefined) {
            // 通知或客户端响应消息：按协议返回 202 Accepted，无响应体
            return { status: 202 };
        }
        return { status: 200, body: response };
    }

    /**
     * 处理单条 JSON-RPC 消息；通知类消息返回 undefined（无响应）
     */
    private async handleSingleMessage(
        service: BuildingAiMcpService,
        message: unknown,
    ): Promise<unknown> {
        if (!this.isRecord(message) || message.jsonrpc !== "2.0") {
            return this.errorBody(null, -32600, "无效的 JSON-RPC 请求");
        }

        const id = this.readId(message.id);
        const method = typeof message.method === "string" ? message.method : undefined;

        // 客户端发来的响应消息（无 method）：无状态模式下直接忽略
        if (method === undefined) {
            return undefined;
        }

        // 通知（无 id）：接受但不响应
        if (id === undefined) {
            return undefined;
        }

        const params = this.isRecord(message.params) ? message.params : {};

        try {
            switch (method) {
                case "initialize":
                    return this.resultBody(id, this.buildInitializeResult(service, params));
                case "ping":
                    return this.resultBody(id, {});
                case "tools/list":
                    return this.resultBody(id, this.buildToolsListResult(service));
                case "tools/call":
                    return this.resultBody(id, await this.callTool(service, params));
                default:
                    return this.errorBody(id, -32601, `不支持的方法：${method}`);
            }
        } catch (error) {
            this.logger.warn(
                `MCP hub request failed (${service.key}/${method}): ${this.getErrorMessage(error)}`,
            );
            return this.errorBody(id, -32603, "服务器内部错误");
        }
    }

    private buildInitializeResult(
        service: BuildingAiMcpService,
        params: Record<string, unknown>,
    ): Record<string, unknown> {
        const requested =
            typeof params.protocolVersion === "string" ? params.protocolVersion : undefined;
        const protocolVersion =
            requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
                ? requested
                : LATEST_PROTOCOL_VERSION;

        return {
            protocolVersion,
            capabilities: { tools: {} },
            serverInfo: {
                name: `buildingai-${service.key}`,
                version: SERVER_VERSION,
            },
        };
    }

    private buildToolsListResult(service: BuildingAiMcpService): Record<string, unknown> {
        return {
            tools: service.tools.map((tool) => ({
                name: tool.name,
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema,
                ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
            })),
        };
    }

    /**
     * 执行 tools/call；未知工具与执行异常按 MCP 约定返回 isError 结果而非 JSON-RPC 错误
     */
    private async callTool(
        service: BuildingAiMcpService,
        params: Record<string, unknown>,
    ): Promise<McpToolCallResult> {
        const toolName = typeof params.name === "string" ? params.name : "";
        const tool = service.tools.find((item) => item.name === toolName);
        if (!tool) {
            return {
                content: [{ type: "text", text: `未找到工具“${toolName}”` }],
                isError: true,
            };
        }

        const args = this.isRecord(params.arguments) ? params.arguments : {};

        try {
            return await tool.execute(args);
        } catch (error) {
            return {
                content: [{ type: "text", text: this.getErrorMessage(error) }],
                isError: true,
            };
        }
    }

    private invalidRequest(id: JsonRpcId, message: string): McpHttpResult {
        return { status: 400, body: this.errorBody(id, -32600, message) };
    }

    private resultBody(id: JsonRpcId, result: unknown): Record<string, unknown> {
        return { jsonrpc: "2.0", id, result };
    }

    private errorBody(id: JsonRpcId, code: number, message: string): Record<string, unknown> {
        return { jsonrpc: "2.0", id, error: { code, message } };
    }

    private readId(value: unknown): JsonRpcId | undefined {
        if (typeof value === "string" || typeof value === "number") {
            return value;
        }
        if (value === null) {
            return null;
        }
        return undefined;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === "object" && !Array.isArray(value);
    }

    private getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
