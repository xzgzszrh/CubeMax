import { createMcpClient } from "@buildingai/ai-sdk";
import {
    type ClassroomToolContext,
    ClassroomToolRegistryService,
} from "@buildingai/core/modules/classroom";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    Agent,
    AiMcpServer,
    AiMcpTool,
    McpCommunicationType,
    XiaozhiAccount,
    XiaozhiAgentBinding,
    XiaozhiMcpConnection,
    XiaozhiMcpConnectionStatus,
    type XiaozhiMcpConnectionStatusType,
    XiaozhiMcpSettings,
} from "@buildingai/db/entities";
import { In, IsNull, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { BuiltinMcpRegistryService } from "@modules/ai/mcp/services/builtin-mcp-registry.service";
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { OrganizationPermission } from "../constants/organization-permissions";
import type {
    BatchConfigureXiaozhiMcpDto,
    ReportXiaozhiMcpCompletionDto,
    UpdateXiaozhiMcpSettingsDto,
} from "../dto/xiaozhi-mcp.dto";
import { OrganizationService } from "./organization.service";
import { XiaozhiCredentialCryptoService } from "./xiaozhi-credential-crypto.service";

/**
 * Emitted whenever the gateway receives a completion report from an agent's
 * MCP tool call (or a manual test report). The classroom module subscribes
 * with `@OnEvent(XIAOZHI_MCP_TASK_COMPLETED_EVENT)`; a listener may return an
 * acknowledgement object (see {@link XiaozhiMcpTaskCompletedAck}) which is
 * relayed back to the calling device. Without any acknowledging listener the
 * report is answered with `accepted: false, reason: "no_active_classroom"`.
 */
export const XIAOZHI_MCP_TASK_COMPLETED_EVENT = "xiaozhi.mcp.task-completed";

export type XiaozhiMcpTaskCompletedEvent = {
    connectionId: string;
    agentBindingId: string;
    agentName: string;
    organizationId: string | null;
    ownerUserId: string;
    taskKey: string;
    summary: string;
    score: number | null;
    source: "mcp" | "manual";
    occurredAt: string;
};

export type XiaozhiMcpTaskCompletedAck = {
    accepted: boolean;
    eventId?: string | null;
    reason?: string;
};

/** Reconnect backoff schedule, mirroring the legacy console gateway. */
const DEFAULT_RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000];
const CONNECT_TIMEOUT_MS = 12_000;
const CONFIGURE_CONCURRENCY = 4;
const WS_OPEN = 1;

const DEFAULT_TOOL_SETTINGS = {
    toolName: "classroom_report_completion",
    toolTitle: "报告课堂任务完成",
    toolDescription:
        "仅当学生已经完成老师要求的课堂任务时调用。调用后会通知课堂控制台，并记录完成摘要。",
    taskKeyDescription: "老师给出的任务标识；没有明确标识时可以省略",
    summaryDescription: "学生完成内容的简短摘要",
    scoreDescription: "有明确评分依据时填写 0 到 100 的得分",
    promptTemplate:
        "当用户已经完成本次课堂任务时，必须调用 MCP 工具 {tool_name}。task_key 填写老师给出的任务标识，summary 简要说明完成内容；有明确评分依据时再填写 score。只有确认任务完成后才能调用，不要提前调用或重复调用。",
} as const;

export type XiaozhiMcpToolSettingsValues = {
    toolName: string;
    toolTitle: string;
    toolDescription: string;
    taskKeyDescription: string;
    summaryDescription: string;
    scoreDescription: string;
    promptTemplate: string;
};

function mcpEndpointBase() {
    return process.env.XIAOZHI_MCP_ENDPOINT_BASE || "wss://api.xiaozhi.me/mcp/";
}

function upstreamApiBase() {
    return (process.env.XIAOZHI_API_BASE || "https://xiaozhi.me/api").replace(/\/$/, "");
}

/** Strip endpoint tokens out of error messages before they are persisted. */
function safeErrorMessage(error: unknown) {
    const message =
        error instanceof Error ? error.message : String(error || "MCP 连接发生未知错误");
    return message
        .replace(/token=[^&\s)]+/gi, "token=***")
        .replace(/wss:\/\/[^\s]+/gi, "MCP 接入点")
        .slice(0, 500);
}

async function mapLimit<T, R>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await task(items[index] as T);
        }
    });
    await Promise.all(workers);
    return results;
}

type JsonRpcId = number | string | null;

type JsonRpcMessage = {
    jsonrpc?: string;
    id?: JsonRpcId;
    method?: string;
    params?: Record<string, unknown>;
    result?: unknown;
    error?: unknown;
};

/**
 * Minimal surface of the WebSocket client. Node 22 ships a WHATWG WebSocket
 * globally (via undici); typing it locally keeps us independent from lib.dom.
 */
type GatewaySocket = {
    readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    addEventListener(
        type: string,
        listener: (event: { data?: unknown; message?: unknown }) => void,
    ): void;
};

/** Workspace fields captured at connect time so tool calls need no DB read. */
type ConnectionSnapshot = {
    connectionId: string;
    agentBindingId: string;
    agentName: string;
    organizationId: string | null;
    ownerUserId: string;
    /** 设备当前分发给的学生，用于把工具调用归到具体的人。 */
    assignedUserId: string | null;
};

/** One BuildingAI MCP tool exposed to the device through this connection. */
type ExposedTool = {
    exposedName: string;
    toolName: string;
    /** 外部 MCP 服务：调用时经 HTTP/SSE 代理过去。 */
    server?: {
        id: string;
        name: string;
        url: string;
        communicationType: string;
        headers: Record<string, string> | null;
    };
    /** 已安装应用注册的工具：在进程内直接调用，并带上设备身份。 */
    internal?: { sessionId: string };
    definition: {
        name: string;
        title?: string;
        description?: string;
        inputSchema: Record<string, unknown>;
    };
};

type ConnectorState = {
    connectionId: string;
    cancelled: boolean;
    attempt: number;
    timer: NodeJS.Timeout | null;
    socket: GatewaySocket | null;
    snapshot: ConnectionSnapshot | null;
    settings: XiaozhiMcpToolSettingsValues;
    exposedTools: Map<string, ExposedTool>;
    /**
     * 本次是否隐藏内置的课堂上报工具。由已安装应用在注册会话时声明。
     * 设备只能照提示词挑工具，两个语义重叠的上报工具同时挂着会让模型无从选择。
     */
    classroomToolSuppressed: boolean;
};

/** Ceiling for one passthrough tools/call round trip. */
const BUILDING_TOOL_CALL_TIMEOUT_MS = 30_000;

/**
 * Long-lived MCP gateway. For every enabled connection it keeps a WebSocket
 * to the upstream xiaozhi.me MCP endpoint open and answers the upstream's
 * MCP-server requests (initialize / tools/list / tools/call), exposing one
 * classroom completion-report tool whose wording is configured per workspace.
 *
 * Connections are restored on boot, torn down on shutdown and re-established
 * with exponential backoff whenever the upstream drops the socket.
 */
@Injectable()
export class XiaozhiMcpGatewayService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(XiaozhiMcpGatewayService.name);
    private readonly connectors = new Map<string, ConnectorState>();
    private readonly reconnectDelays = DEFAULT_RECONNECT_DELAYS;
    private unsubscribeToolRegistry: (() => void) | null = null;

    constructor(
        @InjectRepository(XiaozhiMcpConnection)
        private readonly connectionRepository: Repository<XiaozhiMcpConnection>,
        @InjectRepository(XiaozhiMcpSettings)
        private readonly settingsRepository: Repository<XiaozhiMcpSettings>,
        @InjectRepository(XiaozhiAgentBinding)
        private readonly bindingRepository: Repository<XiaozhiAgentBinding>,
        @InjectRepository(Agent)
        private readonly buildingAgentRepository: Repository<Agent>,
        @InjectRepository(AiMcpServer)
        private readonly mcpServerRepository: Repository<AiMcpServer>,
        @InjectRepository(AiMcpTool)
        private readonly mcpToolRepository: Repository<AiMcpTool>,
        private readonly builtinMcpRegistry: BuiltinMcpRegistryService,
        private readonly classroomToolRegistry: ClassroomToolRegistryService,
        private readonly eventEmitter: EventEmitter2,
        private readonly credentialCrypto: XiaozhiCredentialCryptoService,
    ) {}

    async onModuleInit() {
        // 应用注册/注销工具时只刷新受影响的连接，不断开 WebSocket。
        this.unsubscribeToolRegistry = this.classroomToolRegistry.onChange((agentBindingIds) => {
            for (const agentBindingId of agentBindingIds) {
                void this.reloadAgentTools(agentBindingId);
            }
        });

        // Restore every enabled connection without blocking application boot.
        try {
            const connections = await this.connectionRepository.find({
                where: { enabled: true },
            });
            for (const connection of connections) {
                void this.syncConnection(connection.id);
            }
            if (connections.length) {
                this.logger.log(`Restoring ${connections.length} xiaozhi MCP connection(s)`);
            }
        } catch (error) {
            this.logger.error(`Failed to restore MCP connections: ${safeErrorMessage(error)}`);
        }
    }

    async onModuleDestroy() {
        this.unsubscribeToolRegistry?.();
        this.unsubscribeToolRegistry = null;
        await Promise.all([...this.connectors.keys()].map((id) => this.removeConnection(id)));
    }

    /** (Re)connect one connection; replaces any live connector for the id. */
    async syncConnection(connectionId: string) {
        await this.removeConnection(connectionId);
        const connection = await this.connectionRepository.findOne({
            where: { id: connectionId },
        });
        if (!connection?.enabled) return;
        const state: ConnectorState = {
            connectionId,
            cancelled: false,
            attempt: 0,
            timer: null,
            socket: null,
            snapshot: null,
            settings: { ...DEFAULT_TOOL_SETTINGS },
            exposedTools: new Map(),
            classroomToolSuppressed: false,
        };
        this.connectors.set(connectionId, state);
        void this.connectState(state);
    }

    /** Drop the live connector (if any) without touching persisted state. */
    async removeConnection(connectionId: string) {
        const state = this.connectors.get(connectionId);
        if (!state) return;
        this.connectors.delete(connectionId);
        state.cancelled = true;
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
        const socket = state.socket;
        state.socket = null;
        if (socket) {
            try {
                socket.close(1000);
            } catch {
                // The upstream socket may already be gone.
            }
        }
    }

    /** Reload every enabled connection of one workspace (settings changed). */
    async syncWorkspace(organizationId: string | null, ownerUserId: string) {
        const connections = await this.connectionRepository.find({
            where: organizationId
                ? { organizationId, enabled: true }
                : { organizationId: IsNull(), ownerUserId, enabled: true },
        });
        await Promise.all(connections.map((connection) => this.syncConnection(connection.id)));
    }

    /**
     * Publish a completion report to classroom listeners and relay their
     * acknowledgement. Used by live MCP tool calls and by manual test reports.
     */
    async reportCompletion(
        snapshot: ConnectionSnapshot,
        input: { taskKey?: string; summary: string; score?: number | null },
        source: "mcp" | "manual",
    ): Promise<XiaozhiMcpTaskCompletedAck> {
        const payload: XiaozhiMcpTaskCompletedEvent = {
            connectionId: snapshot.connectionId,
            agentBindingId: snapshot.agentBindingId,
            agentName: snapshot.agentName,
            organizationId: snapshot.organizationId,
            ownerUserId: snapshot.ownerUserId,
            taskKey: input.taskKey?.trim() || "",
            summary: input.summary.trim(),
            score: input.score ?? null,
            source,
            occurredAt: new Date().toISOString(),
        };
        const responses = await this.eventEmitter.emitAsync(
            XIAOZHI_MCP_TASK_COMPLETED_EVENT,
            payload,
        );
        const ack = responses.find(
            (item): item is XiaozhiMcpTaskCompletedAck =>
                Boolean(item) && typeof item === "object" && "accepted" in (item as object),
        );
        return ack ?? { accepted: false, reason: "no_active_classroom" };
    }

    /** Resolve the workspace tool wording, falling back to defaults. */
    private async loadSettings(
        organizationId: string | null,
        ownerUserId: string,
    ): Promise<XiaozhiMcpToolSettingsValues> {
        const row = await this.settingsRepository.findOne({
            where: organizationId ? { organizationId } : { organizationId: IsNull(), ownerUserId },
        });
        if (!row) return { ...DEFAULT_TOOL_SETTINGS };
        return {
            toolName: row.toolName || DEFAULT_TOOL_SETTINGS.toolName,
            toolTitle: row.toolTitle || DEFAULT_TOOL_SETTINGS.toolTitle,
            toolDescription: row.toolDescription || DEFAULT_TOOL_SETTINGS.toolDescription,
            taskKeyDescription: row.taskKeyDescription || DEFAULT_TOOL_SETTINGS.taskKeyDescription,
            summaryDescription: row.summaryDescription || DEFAULT_TOOL_SETTINGS.summaryDescription,
            scoreDescription: row.scoreDescription || DEFAULT_TOOL_SETTINGS.scoreDescription,
            promptTemplate: row.promptTemplate || DEFAULT_TOOL_SETTINGS.promptTemplate,
        };
    }

    private async updateStatus(
        connectionId: string,
        status: XiaozhiMcpConnectionStatusType,
        lastError: string | null = null,
    ) {
        try {
            await this.connectionRepository.update(
                { id: connectionId },
                {
                    status,
                    lastError,
                    ...(status === XiaozhiMcpConnectionStatus.CONNECTED
                        ? { lastConnectedAt: new Date() }
                        : {}),
                },
            );
        } catch (error) {
            this.logger.warn(`Failed to persist MCP status: ${safeErrorMessage(error)}`);
        }
    }

    private async connectState(state: ConnectorState) {
        if (state.cancelled) return;
        const connection = await this.connectionRepository.findOne({
            where: { id: state.connectionId },
        });
        if (!connection?.enabled || state.cancelled) return;

        const binding = await this.bindingRepository.findOne({
            where: { id: connection.agentBindingId },
            select: ["id", "assignedUserId"],
        });

        state.snapshot = {
            connectionId: connection.id,
            agentBindingId: connection.agentBindingId,
            agentName: connection.agentName,
            organizationId: connection.organizationId,
            ownerUserId: connection.ownerUserId,
            assignedUserId: binding?.assignedUserId ?? null,
        };
        state.settings = await this.loadSettings(connection.organizationId, connection.ownerUserId);
        state.exposedTools = await this.loadExposedTools(
            connection.agentBindingId,
            state.settings.toolName,
        );
        state.classroomToolSuppressed = this.classroomToolRegistry.isClassroomToolSuppressed(
            connection.agentBindingId,
        );
        await this.updateStatus(
            connection.id,
            state.attempt === 0
                ? XiaozhiMcpConnectionStatus.CONNECTING
                : XiaozhiMcpConnectionStatus.RECONNECTING,
        );

        const WebSocketImpl = (globalThis as { WebSocket?: new (url: string) => unknown })
            .WebSocket;
        if (typeof WebSocketImpl !== "function") {
            await this.updateStatus(
                connection.id,
                XiaozhiMcpConnectionStatus.ERROR,
                "当前 Node.js 运行时不支持 WebSocket（需要 Node 22+）",
            );
            return;
        }

        let socket: GatewaySocket;
        try {
            await this.credentialCrypto.ensureReadable();
            socket = new WebSocketImpl(
                this.credentialCrypto.decrypt(connection.endpointEncrypted),
            ) as GatewaySocket;
        } catch (error) {
            this.scheduleReconnect(state, safeErrorMessage(error));
            return;
        }
        state.socket = socket;

        let opened = false;
        let lastSocketError: string | null = null;
        const timeout = setTimeout(() => {
            if (opened || state.socket !== socket) return;
            lastSocketError = "MCP WebSocket 连接超时";
            try {
                socket.close();
            } catch {
                // Ignore: the close event below drives the reconnect.
            }
        }, CONNECT_TIMEOUT_MS);

        socket.addEventListener("open", () => {
            clearTimeout(timeout);
            if (state.cancelled || state.socket !== socket) {
                try {
                    socket.close(1000);
                } catch {
                    // Superseded connector; nothing else to do.
                }
                return;
            }
            opened = true;
            state.attempt = 0;
            void this.updateStatus(state.connectionId, XiaozhiMcpConnectionStatus.CONNECTED);
        });

        socket.addEventListener("message", (event) => {
            if (state.cancelled || state.socket !== socket) return;
            if (typeof event.data !== "string") return;
            let message: JsonRpcMessage;
            try {
                message = JSON.parse(event.data) as JsonRpcMessage;
            } catch {
                return;
            }
            void this.handleMessage(state, socket, message);
        });

        socket.addEventListener("error", (event) => {
            const description =
                typeof event.message === "string" && event.message
                    ? event.message
                    : "MCP WebSocket 连接错误";
            lastSocketError = safeErrorMessage(new Error(description));
        });

        socket.addEventListener("close", () => {
            clearTimeout(timeout);
            if (state.socket === socket) state.socket = null;
            if (state.cancelled) return;
            this.scheduleReconnect(state, lastSocketError);
        });
    }

    private scheduleReconnect(state: ConnectorState, errorMessage: string | null = null) {
        if (state.cancelled || state.timer) return;
        void (async () => {
            const connection = await this.connectionRepository.findOne({
                where: { id: state.connectionId },
            });
            if (!connection?.enabled || state.cancelled || state.timer) return;
            await this.updateStatus(
                state.connectionId,
                errorMessage
                    ? XiaozhiMcpConnectionStatus.ERROR
                    : XiaozhiMcpConnectionStatus.RECONNECTING,
                errorMessage,
            );
            if (state.cancelled || state.timer) return;
            const index = Math.min(state.attempt, this.reconnectDelays.length - 1);
            state.attempt += 1;
            state.timer = setTimeout(() => {
                state.timer = null;
                void this.connectState(state);
            }, this.reconnectDelays[index]);
        })();
    }

    // ---------------------------------------------------------------------
    // Minimal MCP server protocol (JSON-RPC 2.0 over the upstream WebSocket)
    // ---------------------------------------------------------------------

    private sendMessage(socket: GatewaySocket, message: Record<string, unknown>) {
        if (socket.readyState !== WS_OPEN) return;
        try {
            socket.send(JSON.stringify({ jsonrpc: "2.0", ...message }));
        } catch (error) {
            this.logger.warn(`Failed to send MCP message: ${safeErrorMessage(error)}`);
        }
    }

    private sendResult(socket: GatewaySocket, id: JsonRpcId, result: unknown) {
        this.sendMessage(socket, { id, result });
    }

    private sendError(socket: GatewaySocket, id: JsonRpcId, code: number, message: string) {
        this.sendMessage(socket, { id, error: { code, message } });
    }

    /**
     * Load the extra MCP tools this connection exposes. Two independent sources:
     *
     * 1. 已安装应用为本次课堂活动注册的工具（进程内注册表）。这类工具**不要求**
     *    设备绑定 BuildingAI 智能体 —— 设备身份来自这条长连接本身。
     * 2. 设备所绑 BuildingAI 智能体上配置的 MCP 服务缓存工具（HTTP/SSE 代理）。
     */
    private async loadExposedTools(
        agentBindingId: string,
        classroomToolName: string,
    ): Promise<Map<string, ExposedTool>> {
        const exposed = new Map<string, ExposedTool>();

        // Names must stay unique across sources and never shadow the
        // classroom tool; suffix duplicates deterministically.
        const reserveName = (toolName: string) => {
            let exposedName = toolName;
            let suffix = 2;
            while (exposedName === classroomToolName || exposed.has(exposedName)) {
                exposedName = `${toolName}_${suffix}`;
                suffix += 1;
            }
            return exposedName;
        };

        for (const tool of this.classroomToolRegistry.listToolsFor(agentBindingId)) {
            const exposedName = reserveName(tool.name);
            exposed.set(exposedName, {
                exposedName,
                toolName: tool.name,
                internal: { sessionId: tool.sessionId },
                definition: {
                    name: exposedName,
                    title: tool.title || tool.name,
                    description: tool.description || `课堂应用提供的工具`,
                    inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
                },
            });
        }

        try {
            const binding = await this.bindingRepository.findOne({
                where: { id: agentBindingId },
            });
            if (!binding?.linkedAgentId) return exposed;
            const buildingAgent = await this.buildingAgentRepository.findOne({
                where: { id: binding.linkedAgentId },
            });
            const serverIds = (buildingAgent?.mcpServerIds || []).filter(Boolean);
            if (!serverIds.length) return exposed;

            const addTool = (
                server: NonNullable<ExposedTool["server"]>,
                toolName: string,
                description: string | null | undefined,
                inputSchema: unknown,
            ) => {
                const exposedName = reserveName(toolName);
                exposed.set(exposedName, {
                    exposedName,
                    toolName,
                    server,
                    definition: {
                        name: exposedName,
                        title: toolName,
                        description: description || `${server.name} 提供的工具`,
                        inputSchema:
                            inputSchema && typeof inputSchema === "object"
                                ? (inputSchema as Record<string, unknown>)
                                : { type: "object", properties: {} },
                    },
                });
            };

            // 平台内置 MCP 服务（内存注册表）与用户配置的服务分开装载。
            const builtinIds = serverIds.filter((id) => this.builtinMcpRegistry.isBuiltinId(id));
            const databaseIds = serverIds.filter((id) => !this.builtinMcpRegistry.isBuiltinId(id));

            for (const builtinId of builtinIds) {
                const server = this.builtinMcpRegistry.getServer(builtinId);
                if (!server || server.isDisabled || !server.connectable) continue;
                const target: ExposedTool["server"] = {
                    id: server.id,
                    name: server.alias || server.name,
                    url: server.url,
                    communicationType: server.communicationType,
                    headers: Object.keys(server.headers || {}).length ? server.headers : null,
                };
                for (const tool of server.tools) {
                    if (!tool.name) continue;
                    addTool(target, tool.name, tool.description, tool.inputSchema);
                }
            }

            if (databaseIds.length) {
                const servers = await this.mcpServerRepository.find({
                    where: { id: In(databaseIds), isDisabled: false },
                });
                const usable = servers.filter((server) => server.url && server.communicationType);
                if (usable.length) {
                    const tools = await this.mcpToolRepository.find({
                        where: { mcpServerId: In(usable.map((server) => server.id)) },
                    });
                    const serverById = new Map(usable.map((server) => [server.id, server]));
                    for (const tool of tools) {
                        const server = serverById.get(tool.mcpServerId);
                        if (!server || !tool.name) continue;
                        addTool(
                            {
                                id: server.id,
                                name: server.name,
                                url: server.url,
                                communicationType: server.communicationType,
                                headers: server.headers ?? null,
                            },
                            tool.name,
                            tool.description,
                            tool.inputSchema,
                        );
                    }
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to load BuildingAI MCP tools: ${safeErrorMessage(error)}`);
        }
        return exposed;
    }

    /**
     * 调用已安装应用注册的工具。
     *
     * 与外部 MCP 服务不同，这里不走 HTTP 代理：直接在进程内调用 handler，
     * 并把设备身份（来自本条长连接，不可伪造）一并交给应用。课堂互动类应用
     * 靠它区分「是哪个学生的方糖猫上报的」。
     */
    private async handleClassroomAppToolCall(
        state: ConnectorState,
        socket: GatewaySocket,
        id: JsonRpcId,
        exposed: ExposedTool,
        params: Record<string, unknown>,
    ) {
        const snapshot = state.snapshot;
        const sessionId = exposed.internal?.sessionId;
        if (!snapshot || !sessionId) {
            this.sendError(socket, id, -32603, "MCP 连接尚未就绪");
            return;
        }

        const context: ClassroomToolContext = {
            agentBindingId: snapshot.agentBindingId,
            agentName: snapshot.agentName,
            organizationId: snapshot.organizationId,
            ownerUserId: snapshot.ownerUserId,
            assignedUserId: snapshot.assignedUserId,
            sessionId,
        };

        try {
            const result = await this.classroomToolRegistry.call(
                context,
                exposed.toolName,
                (params.arguments || {}) as Record<string, unknown>,
            );
            const text = typeof result === "string" ? result : JSON.stringify(result);
            this.sendResult(socket, id, {
                content: [{ type: "text", text }],
                ...(typeof result === "object" && result !== null
                    ? { structuredContent: result }
                    : {}),
                isError: false,
            });
        } catch (error) {
            this.sendError(socket, id, -32603, safeErrorMessage(error));
        }
    }

    /** Proxy one tools/call to the BuildingAI MCP server that owns the tool. */
    private async handleBuildingToolCall(
        socket: GatewaySocket,
        id: JsonRpcId,
        exposed: ExposedTool,
        params: Record<string, unknown>,
    ) {
        const server = exposed.server;
        if (!server) {
            this.sendError(socket, id, -32603, "工具没有可用的 MCP 服务");
            return;
        }
        const args = (params.arguments || {}) as Record<string, unknown>;
        let client: Awaited<ReturnType<typeof createMcpClient>> | null = null;
        try {
            client = await createMcpClient({
                transport: {
                    type: server.communicationType === McpCommunicationType.SSE ? "sse" : "http",
                    url: server.url,
                    ...(server.headers && { headers: server.headers }),
                },
                name: server.name,
            });
            const result = await Promise.race([
                client.callTool(exposed.toolName, args),
                new Promise((_, reject) =>
                    setTimeout(
                        () => reject(new Error("MCP 工具调用超时")),
                        BUILDING_TOOL_CALL_TIMEOUT_MS,
                    ),
                ),
            ]);

            // Pass MCP-shaped results straight through; wrap anything else as text.
            const content = (result as { content?: unknown })?.content;
            if (Array.isArray(content)) {
                this.sendResult(socket, id, result);
            } else {
                this.sendResult(socket, id, {
                    content: [
                        {
                            type: "text",
                            text:
                                typeof result === "string"
                                    ? result
                                    : JSON.stringify(result ?? null),
                        },
                    ],
                    isError: false,
                });
            }
        } catch (error) {
            this.sendError(socket, id, -32603, safeErrorMessage(error));
        } finally {
            if (client) {
                try {
                    await client.close();
                } catch {
                    // Best-effort cleanup; the per-call client is short-lived.
                }
            }
        }
    }

    /**
     * Refresh the exposed BuildingAI tools of the live connection bound to
     * one cubecat (after link/unlink/resync) without dropping the socket, and
     * tell the upstream that the tool list changed.
     */
    async reloadAgentTools(agentBindingId: string) {
        const connection = await this.connectionRepository.findOne({
            where: { agentBindingId },
        });
        if (!connection) return;
        const state = this.connectors.get(connection.id);
        if (!state || state.cancelled) return;
        state.exposedTools = await this.loadExposedTools(agentBindingId, state.settings.toolName);
        state.classroomToolSuppressed =
            this.classroomToolRegistry.isClassroomToolSuppressed(agentBindingId);

        // 设备可能在会话中途被改派给另一个学生；快照是连接时抓的，这里顺带刷新，
        // 否则应用会把上报算到上一个学生头上。
        if (state.snapshot) {
            const binding = await this.bindingRepository.findOne({
                where: { id: agentBindingId },
                select: ["id", "assignedUserId"],
            });
            state.snapshot = {
                ...state.snapshot,
                assignedUserId: binding?.assignedUserId ?? null,
            };
        }

        if (state.socket && state.socket.readyState === WS_OPEN) {
            this.sendMessage(state.socket, {
                jsonrpc: "2.0",
                method: "notifications/tools/list_changed",
            });
        }
    }

    private buildToolDefinition(settings: XiaozhiMcpToolSettingsValues) {
        return {
            name: settings.toolName,
            title: settings.toolTitle,
            description: settings.toolDescription,
            inputSchema: {
                type: "object",
                properties: {
                    task_key: {
                        type: "string",
                        maxLength: 100,
                        description: settings.taskKeyDescription,
                    },
                    summary: {
                        type: "string",
                        minLength: 1,
                        maxLength: 300,
                        description: settings.summaryDescription,
                    },
                    score: {
                        type: "number",
                        minimum: 0,
                        maximum: 100,
                        description: settings.scoreDescription,
                    },
                },
                required: ["summary"],
                additionalProperties: false,
            },
            annotations: {
                title: settings.toolTitle,
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
            },
        };
    }

    private async handleMessage(
        state: ConnectorState,
        socket: GatewaySocket,
        message: JsonRpcMessage,
    ) {
        // Notifications ("notifications/initialized", cancellations, ...) and
        // responses to requests we never send are silently ignored.
        if (!message.method || message.id === undefined || message.id === null) return;
        const id = message.id;

        switch (message.method) {
            case "initialize": {
                const requested = message.params?.protocolVersion;
                this.sendResult(socket, id, {
                    protocolVersion: typeof requested === "string" ? requested : "2025-03-26",
                    capabilities: { tools: { listChanged: true } },
                    serverInfo: { name: "buildingai-classroom", version: "1.0.0" },
                });
                return;
            }
            case "ping":
                this.sendResult(socket, id, {});
                return;
            case "tools/list":
                this.sendResult(socket, id, {
                    tools: [
                        // 应用声明接管上报时，内置工具整个从工具表里消失，
                        // 而不是留在表里等调用后再拒绝 —— 模型看不到就不会误选。
                        ...(state.classroomToolSuppressed
                            ? []
                            : [this.buildToolDefinition(state.settings)]),
                        ...[...state.exposedTools.values()].map((tool) => tool.definition),
                    ],
                });
                return;
            case "tools/call":
                await this.handleToolCall(state, socket, id, message.params || {});
                return;
            default:
                this.sendError(socket, id, -32601, `不支持的 MCP 方法: ${message.method}`);
        }
    }

    private async handleToolCall(
        state: ConnectorState,
        socket: GatewaySocket,
        id: JsonRpcId,
        params: Record<string, unknown>,
    ) {
        if (!state.snapshot) {
            this.sendError(socket, id, -32603, "MCP 连接尚未就绪");
            return;
        }
        if (params.name !== state.settings.toolName) {
            const exposed = state.exposedTools.get(String(params.name || ""));
            if (exposed?.internal) {
                await this.handleClassroomAppToolCall(state, socket, id, exposed, params);
                return;
            }
            if (exposed?.server) {
                await this.handleBuildingToolCall(socket, id, exposed, params);
                return;
            }
            this.sendError(socket, id, -32602, `未知工具: ${String(params.name || "")}`);
            return;
        }
        // 模型可能还拿着隐藏前缓存的工具表；明确告知它改用应用提供的工具。
        if (state.classroomToolSuppressed) {
            this.sendError(
                socket,
                id,
                -32602,
                `${state.settings.toolName} 在当前课堂应用运行期间不可用，请使用应用提供的工具`,
            );
            return;
        }
        const args = (params.arguments || {}) as Record<string, unknown>;
        const summary = typeof args.summary === "string" ? args.summary.trim() : "";
        const taskKey = typeof args.task_key === "string" ? args.task_key.trim() : "";
        const score =
            typeof args.score === "number" && Number.isFinite(args.score) ? args.score : null;
        if (!summary || summary.length > 300 || taskKey.length > 100) {
            this.sendError(socket, id, -32602, "summary 为必填（1-300字符），task_key 最长100字符");
            return;
        }
        if (score !== null && (score < 0 || score > 100)) {
            this.sendError(socket, id, -32602, "score 必须在 0 到 100 之间");
            return;
        }

        try {
            const ack = await this.reportCompletion(
                state.snapshot,
                { taskKey, summary, score },
                "mcp",
            );
            const response = {
                ok: ack.accepted,
                event_id: ack.eventId || null,
                accepted: ack.accepted,
                reason: ack.reason || null,
            };
            this.sendResult(socket, id, {
                content: [{ type: "text", text: JSON.stringify(response) }],
                structuredContent: response,
                isError: false,
            });
        } catch (error) {
            this.sendError(socket, id, -32603, safeErrorMessage(error));
        }
    }
}

type McpConfigureResult = {
    agentId: string;
    agentName: string;
    connectionId?: string;
    success: boolean;
    message?: string;
};

/**
 * Workspace-facing management API around the gateway: listing connections,
 * per-workspace tool wording, batch endpoint provisioning against the
 * upstream console, and per-connection lifecycle actions.
 */
@Injectable()
export class XiaozhiMcpService {
    constructor(
        @InjectRepository(XiaozhiMcpConnection)
        private readonly connectionRepository: Repository<XiaozhiMcpConnection>,
        @InjectRepository(XiaozhiMcpSettings)
        private readonly settingsRepository: Repository<XiaozhiMcpSettings>,
        @InjectRepository(XiaozhiAgentBinding)
        private readonly agentRepository: Repository<XiaozhiAgentBinding>,
        @InjectRepository(XiaozhiAccount)
        private readonly accountRepository: Repository<XiaozhiAccount>,
        private readonly organizationService: OrganizationService,
        private readonly gateway: XiaozhiMcpGatewayService,
        private readonly credentialCrypto: XiaozhiCredentialCryptoService,
    ) {}

    private async requireRead(userId: string, organizationId?: string | null) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            organizationId ? OrganizationPermission.ASSET_READ : undefined,
        );
    }

    private async requireManage(userId: string, organizationId?: string | null) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            organizationId ? OrganizationPermission.ASSET_MANAGE : undefined,
        );
    }

    private workspaceWhere(userId: string, organizationId?: string | null) {
        return organizationId
            ? { organizationId }
            : { organizationId: IsNull(), ownerUserId: userId };
    }

    private toPublicConnection(connection: XiaozhiMcpConnection, accountLabel = "") {
        return {
            id: connection.id,
            organizationId: connection.organizationId,
            ownerUserId: connection.ownerUserId,
            agentBindingId: connection.agentBindingId,
            agentName: connection.agentName,
            accountLabel,
            endpointMasked: `${mcpEndpointBase()}?token=***`,
            enabled: connection.enabled,
            status: connection.status,
            lastConnectedAt: connection.lastConnectedAt,
            lastError: connection.lastError,
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt,
        };
    }

    async listConnections(userId: string, organizationId?: string | null) {
        await this.requireRead(userId, organizationId);
        const connections = await this.connectionRepository.find({
            where: this.workspaceWhere(userId, organizationId),
            order: { agentName: "ASC", createdAt: "ASC" },
        });
        if (!connections.length) return [];

        // Resolve the owning account labels through the agent bindings so the
        // UI can group connections the way the workspace device list does.
        const agents = await this.agentRepository.find({
            where: { id: In(connections.map((item) => item.agentBindingId)) },
        });
        const agentById = new Map(agents.map((agent) => [agent.id, agent]));
        const accountIds = [...new Set(agents.map((agent) => agent.xiaozhiAccountId))];
        const accounts = accountIds.length
            ? await this.accountRepository.find({ where: { id: In(accountIds) } })
            : [];
        const labelByAccountId = new Map(accounts.map((account) => [account.id, account.label]));
        return connections.map((connection) => {
            const agent = agentById.get(connection.agentBindingId);
            const label = agent ? labelByAccountId.get(agent.xiaozhiAccountId) || "" : "已移除账号";
            return this.toPublicConnection(connection, label);
        });
    }

    async getSettings(userId: string, organizationId?: string | null) {
        await this.requireRead(userId, organizationId);
        const row = await this.settingsRepository.findOne({
            where: organizationId
                ? { organizationId }
                : { organizationId: IsNull(), ownerUserId: userId },
        });
        return this.toPublicSettings(row);
    }

    private toPublicSettings(row: XiaozhiMcpSettings | null) {
        const values: XiaozhiMcpToolSettingsValues = row
            ? {
                  toolName: row.toolName,
                  toolTitle: row.toolTitle,
                  toolDescription: row.toolDescription,
                  taskKeyDescription: row.taskKeyDescription,
                  summaryDescription: row.summaryDescription,
                  scoreDescription: row.scoreDescription,
                  promptTemplate: row.promptTemplate,
              }
            : { ...DEFAULT_TOOL_SETTINGS };
        return {
            ...values,
            promptSnippet: values.promptTemplate.replaceAll("{tool_name}", values.toolName),
            updatedAt: row?.updatedAt ?? null,
        };
    }

    async updateSettings(
        userId: string,
        organizationId: string | null | undefined,
        dto: UpdateXiaozhiMcpSettingsDto,
    ) {
        await this.requireManage(userId, organizationId);
        let row = await this.settingsRepository.findOne({
            where: organizationId
                ? { organizationId }
                : { organizationId: IsNull(), ownerUserId: userId },
        });
        if (!row) {
            row = this.settingsRepository.create({
                organizationId: organizationId || null,
                ownerUserId: userId,
            });
        }
        row.toolName = dto.toolName.trim();
        row.toolTitle = dto.toolTitle.trim();
        row.toolDescription = dto.toolDescription.trim();
        row.taskKeyDescription = dto.taskKeyDescription.trim();
        row.summaryDescription = dto.summaryDescription.trim();
        row.scoreDescription = dto.scoreDescription.trim();
        row.promptTemplate = dto.promptTemplate.trim();
        const saved = await this.settingsRepository.save(row);

        // Live connections keep a settings snapshot; reload them so the
        // upstream sees the new tool wording immediately.
        await this.gateway.syncWorkspace(organizationId || null, userId);
        return this.toPublicSettings(saved);
    }

    /**
     * Provision MCP endpoints for a batch of agents: ask the upstream console
     * for a fresh endpoint token per agent, persist the (encrypted) endpoint
     * and connect. Per-agent failures are reported instead of aborting.
     */
    async batchConfigure(
        userId: string,
        organizationId: string | null | undefined,
        dto: BatchConfigureXiaozhiMcpDto,
    ) {
        await this.requireManage(userId, organizationId);
        const where = this.workspaceWhere(userId, organizationId);
        let agents: XiaozhiAgentBinding[];
        if (dto.agentIds?.length) {
            agents = await this.agentRepository.find({ where: { ...where, id: In(dto.agentIds) } });
            if (agents.length !== dto.agentIds.length) {
                throw HttpErrorFactory.badRequest("部分目标智能体不存在或不属于当前工作空间");
            }
        } else {
            agents = await this.agentRepository.find({ where, order: { name: "ASC" } });
        }
        if (!agents.length) {
            throw HttpErrorFactory.badRequest("当前工作空间还没有可配置的智能体");
        }

        const accountIds = [...new Set(agents.map((agent) => agent.xiaozhiAccountId))];
        const accounts = await this.accountRepository.find({ where: { id: In(accountIds) } });
        const accountById = new Map(accounts.map((account) => [account.id, account]));

        const results = await mapLimit(
            agents,
            CONFIGURE_CONCURRENCY,
            async (agent): Promise<McpConfigureResult> => {
                try {
                    const account = accountById.get(agent.xiaozhiAccountId);
                    if (!account) throw new Error("智能体所属的小智账号不存在");
                    const token = await this.generateEndpointToken(account, agent);
                    const endpoint = `${mcpEndpointBase()}?token=${encodeURIComponent(token)}`;
                    const connection = await this.upsertConnection(agent, endpoint);
                    await this.gateway.syncConnection(connection.id);
                    return {
                        agentId: agent.id,
                        agentName: agent.name,
                        connectionId: connection.id,
                        success: true,
                    };
                } catch (error) {
                    return {
                        agentId: agent.id,
                        agentName: agent.name,
                        success: false,
                        message: safeErrorMessage(error),
                    };
                }
            },
        );
        const failed = results.filter((result) => !result.success).length;
        return {
            results,
            succeeded: results.length - failed,
            failed,
            status: failed === 0 ? "success" : failed === results.length ? "failed" : "partial",
        };
    }

    /** Ask the upstream console to mint an MCP endpoint token for one agent. */
    private async generateEndpointToken(account: XiaozhiAccount, agent: XiaozhiAgentBinding) {
        await this.credentialCrypto.ensureReadable();
        const headers: Record<string, string> = {
            Accept: "application/json",
            Authorization: `Bearer ${this.credentialCrypto.decrypt(account.accessTokenEncrypted)}`,
        };
        if (account.sessionCookieEncrypted) {
            headers.Cookie = this.credentialCrypto.decrypt(account.sessionCookieEncrypted);
        }
        let response: Response;
        try {
            response = await fetch(
                `${upstreamApiBase()}/agents/${agent.upstreamAgentId}/generate-mcp-endpoint-token`,
                { method: "POST", headers },
            );
        } catch {
            throw new Error("无法连接小智服务");
        }
        let payload: {
            token?: string;
            data?: { token?: string };
            message?: string;
            error?: string;
        } = {};
        try {
            payload = (await response.json()) as typeof payload;
        } catch {
            // Non-JSON body: fall through to the status check below.
        }
        if (!response.ok) {
            throw new Error(payload.message || payload.error || `小智接口返回 ${response.status}`);
        }
        const token = payload.token || payload.data?.token;
        if (!token || token.length < 20) throw new Error("小智接口未返回有效 MCP 接入令牌");
        return token;
    }

    /** One connection per agent binding; soft-deleted rows are revived. */
    private async upsertConnection(agent: XiaozhiAgentBinding, endpoint: string) {
        await this.credentialCrypto.ensureWritable();
        const existing = await this.connectionRepository.findOne({
            where: { agentBindingId: agent.id },
            withDeleted: true,
        });
        const connection =
            existing ||
            this.connectionRepository.create({
                agentBindingId: agent.id,
                organizationId: agent.organizationId,
                ownerUserId: agent.ownerUserId,
            });
        connection.deletedAt = null;
        connection.organizationId = agent.organizationId;
        connection.ownerUserId = agent.ownerUserId;
        connection.agentName = agent.name;
        connection.endpointEncrypted = this.credentialCrypto.encrypt(endpoint);
        connection.enabled = true;
        connection.status = XiaozhiMcpConnectionStatus.CONNECTING;
        connection.lastError = null;
        return this.connectionRepository.save(connection);
    }

    private async resolveConnection(
        userId: string,
        organizationId: string | null | undefined,
        connectionId: string,
    ) {
        const connection = await this.connectionRepository.findOne({
            where: { id: connectionId, ...this.workspaceWhere(userId, organizationId) },
        });
        if (!connection) throw HttpErrorFactory.notFound("MCP 连接不存在");
        return connection;
    }

    async reconnectConnection(
        userId: string,
        organizationId: string | null | undefined,
        connectionId: string,
    ) {
        await this.requireManage(userId, organizationId);
        const connection = await this.resolveConnection(userId, organizationId, connectionId);
        connection.enabled = true;
        connection.status = XiaozhiMcpConnectionStatus.CONNECTING;
        connection.lastError = null;
        await this.connectionRepository.save(connection);
        await this.gateway.syncConnection(connection.id);
        const current = await this.connectionRepository.findOne({ where: { id: connection.id } });
        return this.toPublicConnection(current || connection);
    }

    async setConnectionEnabled(
        userId: string,
        organizationId: string | null | undefined,
        connectionId: string,
        enabled: boolean,
    ) {
        await this.requireManage(userId, organizationId);
        const connection = await this.resolveConnection(userId, organizationId, connectionId);
        connection.enabled = enabled;
        connection.status = enabled
            ? XiaozhiMcpConnectionStatus.CONNECTING
            : XiaozhiMcpConnectionStatus.DISABLED;
        connection.lastError = null;
        await this.connectionRepository.save(connection);
        if (enabled) await this.gateway.syncConnection(connection.id);
        else await this.gateway.removeConnection(connection.id);
        return this.toPublicConnection(connection);
    }

    async removeConnection(
        userId: string,
        organizationId: string | null | undefined,
        connectionId: string,
    ) {
        await this.requireManage(userId, organizationId);
        const connection = await this.resolveConnection(userId, organizationId, connectionId);
        await this.gateway.removeConnection(connection.id);
        connection.enabled = false;
        connection.status = XiaozhiMcpConnectionStatus.DISABLED;
        await this.connectionRepository.save(connection);
        await this.connectionRepository.softRemove(connection);
        return { success: true, removed: connection.agentName };
    }

    /**
     * Manual completion report (classroom test tool). Emits the same event a
     * live MCP tool call does, tagged with source "manual".
     */
    async reportManualCompletion(
        userId: string,
        organizationId: string | null | undefined,
        connectionId: string,
        dto: ReportXiaozhiMcpCompletionDto,
    ) {
        await this.requireManage(userId, organizationId);
        const connection = await this.resolveConnection(userId, organizationId, connectionId);
        const binding = await this.agentRepository.findOne({
            where: { id: connection.agentBindingId },
            select: ["id", "assignedUserId"],
        });
        return this.gateway.reportCompletion(
            {
                connectionId: connection.id,
                agentBindingId: connection.agentBindingId,
                agentName: connection.agentName,
                organizationId: connection.organizationId,
                ownerUserId: connection.ownerUserId,
                assignedUserId: binding?.assignedUserId ?? null,
            },
            { taskKey: dto.taskKey, summary: dto.summary, score: dto.score },
            "manual",
        );
    }
}
