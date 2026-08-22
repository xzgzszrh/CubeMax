import type { ProgrammingProjectPublishedSnapshot } from "@buildingai/db/entities";
import { HttpErrorFactory } from "@buildingai/errors";
import type { WebhookExecutorInput, WebhookExecutorResult } from "@flowgram.ai/runtime-js";
import { Injectable } from "@nestjs/common";

import { WorkflowWebhookToolRegistry } from "../organization/services/workflow-webhook-tool-registry.service";
import { WorkflowWaitRegistry } from "./workflow-wait-registry.service";

const TOOL_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

function isPublishedSnapshot(value: unknown): value is ProgrammingProjectPublishedSnapshot {
    return (
        !!value &&
        typeof value === "object" &&
        (value as ProgrammingProjectPublishedSnapshot).version === 1
    );
}

function asText(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === undefined || value === null) return "";
    return String(value);
}

function asNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
        return Number(value);
    }
    return undefined;
}

function asSchema(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return { type: "object", properties: {} };
}

@Injectable()
export class WorkflowWebhookExecutorService {
    constructor(
        private readonly webhookTools: WorkflowWebhookToolRegistry,
        private readonly waitRegistry: WorkflowWaitRegistry,
    ) {}

    async execute(input: WebhookExecutorInput): Promise<WebhookExecutorResult> {
        const toolName = asText(input.node.data?.toolName).trim();
        if (!toolName) throw HttpErrorFactory.badRequest("请填写回传工具名称");
        if (!TOOL_NAME_PATTERN.test(toolName)) {
            throw HttpErrorFactory.badRequest("工具名必须以字母开头，只能包含字母、数字和下划线");
        }

        const agentId = this.resolveAgentId(input);
        if (!agentId) {
            throw HttpErrorFactory.badRequest("请先在工程设置中绑定 CubeCat 智能体");
        }

        const timeoutMs = asNumber(input.node.data?.timeoutMs) ?? 0;
        const context = asText(input.inputs.context);
        const sessionId = `webhook:${input.node.id}:${Date.now()}`;

        this.webhookTools.register(sessionId, agentId, [
            {
                name: toolName,
                title: toolName,
                description: asText(input.node.data?.toolDescription).trim() || "工作流回传端点",
                inputSchema: asSchema(input.node.data?.inputSchema),
                handler: (args) => ({ received: true, ...args }),
            },
        ]);

        try {
            const result = await this.waitRegistry.wait(
                {
                    triggerId: toolName,
                    xiaozhiAgentId: agentId,
                    projectId: input.runtimeContext?.projectId,
                },
                { timeoutMs, signal: input.signal },
            );

            const payload = result.event?.data ?? {};
            const action = typeof payload.action === "string" ? payload.action : "";

            if (result.timedOut) {
                return {
                    branch: "error",
                    outputs: {
                        received: false,
                        data: {},
                        action: "",
                        timestamp: Date.now(),
                        context,
                    },
                };
            }

            return {
                branch: "received",
                outputs: {
                    received: true,
                    data: payload,
                    action,
                    timestamp: Date.now(),
                    context,
                },
            };
        } finally {
            this.webhookTools.unregister(sessionId);
        }
    }

    private resolveAgentId(input: WebhookExecutorInput): string | undefined {
        const snapshot = isPublishedSnapshot(input.runtimeContext?.publishedSnapshot)
            ? input.runtimeContext?.publishedSnapshot
            : undefined;
        const fromSnapshot = snapshot?.runtime.xiaozhiAgentId;
        const fromContext = input.runtimeContext?.xiaozhiAgentId;
        if (typeof fromSnapshot === "string" && fromSnapshot) return fromSnapshot;
        if (typeof fromContext === "string" && fromContext) return fromContext;
        return undefined;
    }
}
