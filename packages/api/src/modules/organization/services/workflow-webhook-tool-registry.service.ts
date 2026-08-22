import { Injectable, Logger } from "@nestjs/common";

const TOOL_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

export type WorkflowWebhookToolHandler = (
    args: Record<string, unknown>,
) => Promise<unknown> | unknown;

export type WorkflowWebhookToolDefinition = {
    name: string;
    title?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    handler: WorkflowWebhookToolHandler;
};

export type RegisteredWorkflowWebhookTool = WorkflowWebhookToolDefinition & {
    sessionId: string;
    agentBindingId: string;
};

type RegisteredSession = {
    sessionId: string;
    agentBindingId: string;
    tools: Map<string, WorkflowWebhookToolDefinition>;
};

@Injectable()
export class WorkflowWebhookToolRegistry {
    private readonly logger = new Logger(WorkflowWebhookToolRegistry.name);
    private readonly sessions = new Map<string, RegisteredSession>();
    private readonly index = new Map<string, Set<string>>();
    private readonly listeners = new Set<(agentBindingIds: string[]) => void>();

    onChange(listener: (agentBindingIds: string[]) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    register(sessionId: string, agentBindingId: string, tools: WorkflowWebhookToolDefinition[]) {
        if (!sessionId) throw new Error("sessionId 不能为空");
        if (!agentBindingId) throw new Error("agentBindingId 不能为空");
        for (const tool of tools) {
            if (!TOOL_NAME_PATTERN.test(tool.name)) {
                throw new Error(`工具名不合法: ${tool.name}`);
            }
            if (typeof tool.handler !== "function") {
                throw new Error(`工具 ${tool.name} 缺少 handler`);
            }
        }

        const previous = this.sessions.get(sessionId);
        const affected = new Set<string>(previous ? [previous.agentBindingId] : []);
        if (previous) this.dropIndex(previous);

        const session: RegisteredSession = {
            sessionId,
            agentBindingId,
            tools: new Map(tools.map((tool) => [tool.name, tool])),
        };
        this.sessions.set(sessionId, session);
        affected.add(agentBindingId);
        const bucket = this.index.get(agentBindingId) ?? new Set<string>();
        bucket.add(sessionId);
        this.index.set(agentBindingId, bucket);

        this.logger.log(
            `Webhook session ${sessionId} registered ${session.tools.size} tool(s) on ${agentBindingId}`,
        );
        this.notify([...affected]);
    }

    unregister(sessionId: string) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        this.dropIndex(session);
        this.sessions.delete(sessionId);
        this.logger.log(`Webhook session ${sessionId} unregistered`);
        this.notify([session.agentBindingId]);
    }

    listToolsFor(agentBindingId: string): RegisteredWorkflowWebhookTool[] {
        const sessionIds = this.index.get(agentBindingId);
        if (!sessionIds?.size) return [];
        const tools: RegisteredWorkflowWebhookTool[] = [];
        for (const sessionId of sessionIds) {
            const session = this.sessions.get(sessionId);
            if (!session) continue;
            for (const tool of session.tools.values()) {
                tools.push({ ...tool, sessionId, agentBindingId: session.agentBindingId });
            }
        }
        return tools;
    }

    resolve(agentBindingId: string, sessionId: string, toolName: string) {
        const session = this.sessions.get(sessionId);
        if (!session || session.agentBindingId !== agentBindingId) return undefined;
        return session.tools.get(toolName);
    }

    async call(
        agentBindingId: string,
        sessionId: string,
        toolName: string,
        args: Record<string, unknown>,
    ): Promise<unknown> {
        const tool = this.resolve(agentBindingId, sessionId, toolName);
        if (!tool) throw new Error(`回传工具 ${toolName} 已失效`);
        return tool.handler(args);
    }

    private dropIndex(session: RegisteredSession) {
        const bucket = this.index.get(session.agentBindingId);
        if (!bucket) return;
        bucket.delete(session.sessionId);
        if (!bucket.size) this.index.delete(session.agentBindingId);
    }

    private notify(agentBindingIds: string[]) {
        const unique = [...new Set(agentBindingIds.filter(Boolean))];
        if (!unique.length) return;
        for (const listener of this.listeners) {
            try {
                listener(unique);
            } catch (error) {
                this.logger.warn(
                    `Webhook tool listener failed: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        }
    }
}
