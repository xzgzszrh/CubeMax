import { Injectable, Logger } from "@nestjs/common";

/**
 * 一次 MCP 工具调用的来龙去脉。
 *
 * 设备身份不是应用传进来的参数，而是网关从**这条长连接本身**推导出来的：
 * 每台方糖猫在小智侧有独立的 MCP 接入地址，网关为每个地址维持一条 WebSocket，
 * 因此收到 tools/call 时就已经知道是哪台设备在调用。应用拿到的身份因此是可信的。
 */
export type ClassroomToolContext = {
    /** 方糖猫智能体绑定ID，等价于「哪台设备」。 */
    agentBindingId: string;
    agentName: string;
    /** 所属组织；个人空间为 null。 */
    organizationId: string | null;
    /** 绑定该设备的系统用户。 */
    ownerUserId: string;
    /** 设备当前分发给的学生；未分发时为 null。 */
    assignedUserId: string | null;
    /** 注册这批工具的应用会话。 */
    sessionId: string;
};

/** 工具返回值：字符串按文本回传，对象按 JSON 回传。 */
export type ClassroomToolResult = string | Record<string, unknown>;

export type ClassroomToolHandler = (
    args: Record<string, unknown>,
    context: ClassroomToolContext,
) => Promise<ClassroomToolResult> | ClassroomToolResult;

export type ClassroomToolDefinition = {
    /** 暴露给方糖猫的工具名，需符合 MCP 命名（字母、数字、下划线）。 */
    name: string;
    title?: string;
    description?: string;
    /** JSON Schema；省略时按无参处理。 */
    inputSchema?: Record<string, unknown>;
    handler: ClassroomToolHandler;
};

export type RegisteredClassroomTool = ClassroomToolDefinition & { sessionId: string };

export type ClassroomSessionOptions = {
    /**
     * 会话期间是否隐藏内置的 `classroom_report_completion`。
     *
     * 方糖猫只认两样东西：提示词和工具表。它无从判断"现在在不在上课"，
     * 只能照着提示词去挑工具。所以当应用自己提供了一个语义重叠的上报工具时，
     * 两个都挂着会让模型无从选择。应用可以：
     * - 保持默认（false）：复用内置工具做设备状态上报，自己不再造一个；
     * - 置为 true：完全由应用的工具接管，内置工具在本次会话中从工具表里消失。
     */
    suppressClassroomTool?: boolean;
};

type RegisteredSession = {
    sessionId: string;
    /** 这批工具挂载到哪些设备上。 */
    agentBindingIds: Set<string>;
    tools: Map<string, ClassroomToolDefinition>;
    suppressClassroomTool: boolean;
};

const TOOL_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

/**
 * 进程内的课堂应用 MCP 工具注册表。
 *
 * 已安装的应用在开启一次课堂活动时，把自己的工具挂到指定的一批方糖猫上；
 * 活动结束再整体注销。与「用户在后台配置的 MCP 服务」不同，这里的工具
 * 不经过 HTTP 回环，网关直接在进程内调用 handler，因此能顺带把调用方
 * 身份交给应用 —— 这正是课堂互动类应用（谁先破解、谁还没完成）的前提。
 *
 * 该服务被 `@Global()` 的 ClassroomKitModule 提供，网关与应用拿到的是同一个实例。
 */
@Injectable()
export class ClassroomToolRegistryService {
    private readonly logger = new Logger(ClassroomToolRegistryService.name);
    private readonly sessions = new Map<string, RegisteredSession>();
    /** agentBindingId -> sessionId 集合，避免每次调用都全表扫描。 */
    private readonly index = new Map<string, Set<string>>();
    private readonly listeners = new Set<(agentBindingIds: string[]) => void>();

    /**
     * 订阅工具集变化。网关据此对受影响的连接推送 `notifications/tools/list_changed`，
     * 不需要断开重连。返回取消订阅的函数。
     */
    onChange(listener: (agentBindingIds: string[]) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(agentBindingIds: string[]) {
        if (!agentBindingIds.length) return;
        for (const listener of this.listeners) {
            try {
                listener(agentBindingIds);
            } catch (error) {
                // 单个订阅者出错不该影响其它订阅者或调用方。
                this.logger.warn(
                    `Classroom tool listener failed: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        }
    }

    /**
     * 注册（或整体替换）一个会话的工具。
     * 重复调用同一个 sessionId 会覆盖上一次，方便应用在活动中途调整设备范围。
     */
    registerSession(
        sessionId: string,
        agentBindingIds: string[],
        tools: ClassroomToolDefinition[],
        options: ClassroomSessionOptions = {},
    ) {
        if (!sessionId) throw new Error("sessionId 不能为空");
        for (const tool of tools) {
            if (!TOOL_NAME_PATTERN.test(tool.name)) {
                throw new Error(`工具名不合法: ${tool.name}`);
            }
            if (typeof tool.handler !== "function") {
                throw new Error(`工具 ${tool.name} 缺少 handler`);
            }
        }

        const previous = this.sessions.get(sessionId);
        const affected = new Set<string>(previous?.agentBindingIds ?? []);
        if (previous) this.dropIndex(previous);

        const session: RegisteredSession = {
            sessionId,
            agentBindingIds: new Set(agentBindingIds.filter(Boolean)),
            tools: new Map(tools.map((tool) => [tool.name, tool])),
            suppressClassroomTool: options.suppressClassroomTool ?? false,
        };
        this.sessions.set(sessionId, session);
        for (const agentBindingId of session.agentBindingIds) {
            affected.add(agentBindingId);
            const bucket = this.index.get(agentBindingId) ?? new Set<string>();
            bucket.add(sessionId);
            this.index.set(agentBindingId, bucket);
        }

        this.logger.log(
            `Session ${sessionId} registered ${session.tools.size} tool(s) on ${session.agentBindingIds.size} device(s)`,
        );
        this.notify([...affected]);
    }

    /** 注销一个会话的全部工具；活动结束时调用。 */
    unregisterSession(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        this.dropIndex(session);
        this.sessions.delete(sessionId);
        this.logger.log(`Session ${sessionId} unregistered`);
        this.notify([...session.agentBindingIds]);
    }

    private dropIndex(session: RegisteredSession) {
        for (const agentBindingId of session.agentBindingIds) {
            const bucket = this.index.get(agentBindingId);
            if (!bucket) continue;
            bucket.delete(session.sessionId);
            if (!bucket.size) this.index.delete(agentBindingId);
        }
    }

    /** 某台设备当前可见的全部应用工具。 */
    listToolsFor(agentBindingId: string): RegisteredClassroomTool[] {
        const sessionIds = this.index.get(agentBindingId);
        if (!sessionIds?.size) return [];
        const tools: RegisteredClassroomTool[] = [];
        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (!session) continue;
            for (const tool of session.tools.values()) {
                tools.push({ ...tool, sessionId });
            }
        }
        return tools;
    }

    /** 精确取一个工具，用于 tools/call 分发。 */
    resolve(agentBindingId: string, sessionId: string, toolName: string) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.agentBindingIds.has(agentBindingId)) return undefined;
        return session.tools.get(toolName);
    }

    /** 当前正接管这台设备的会话，用于在设备列表上标出「上课中」。 */
    listSessionIdsFor(agentBindingId: string): string[] {
        return [...(this.index.get(agentBindingId) ?? [])];
    }

    /**
     * 这台设备当前是否有会话要求隐藏内置的课堂上报工具。
     *
     * 多个会话同时覆盖同一台设备时取"或" —— 只要有一个应用声明自己接管上报，
     * 就不再把语义重叠的内置工具暴露给模型。
     */
    isClassroomToolSuppressed(agentBindingId: string): boolean {
        const sessionIds = this.index.get(agentBindingId);
        if (!sessionIds?.size) return false;
        for (const sessionId of sessionIds) {
            if (this.sessions.get(sessionId)?.suppressClassroomTool) return true;
        }
        return false;
    }

    /** 调用工具。handler 抛错由调用方（网关）转成 MCP 错误响应。 */
    async call(
        context: ClassroomToolContext,
        toolName: string,
        args: Record<string, unknown>,
    ): Promise<ClassroomToolResult> {
        const tool = this.resolve(context.agentBindingId, context.sessionId, toolName);
        if (!tool) throw new Error(`工具 ${toolName} 已失效`);
        return tool.handler(args, context);
    }
}
