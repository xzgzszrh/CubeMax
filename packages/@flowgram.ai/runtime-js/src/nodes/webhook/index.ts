import type {
    ExecutionContext,
    ExecutionResult,
    FlowGramNode,
    INodeExecutor,
} from "@flowgram.ai/runtime-interface";

export type WebhookExecutorInput = {
    userId?: string;
    runtimeContext?: {
        projectId?: string;
        runtimeTarget?: "local" | "simulator" | "device";
        simulatorSessionId?: string;
        deviceId?: string;
        xiaozhiAgentId?: string;
        publishedSnapshot?: unknown;
    };
    node: { id: string; type: string; data?: Record<string, unknown> };
    inputs: Record<string, unknown>;
    signal?: AbortSignal;
};

export type WebhookExecutorResult = {
    outputs: Record<string, unknown>;
    branch: "received" | "error";
};

export type WebhookExecutorHandler = (
    input: WebhookExecutorInput,
) => Promise<WebhookExecutorResult> | WebhookExecutorResult;

let workflowRuntimeWebhookExecutor: WebhookExecutorHandler | undefined;

export const registerWebhookExecutor = (executor: WebhookExecutorHandler): void => {
    workflowRuntimeWebhookExecutor = executor;
};

export class WebhookExecutor implements INodeExecutor {
    public readonly type = "webhook" as FlowGramNode;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        if (!workflowRuntimeWebhookExecutor) {
            throw new Error("Webhook executor is not registered");
        }

        const abort = new AbortController();
        const timer = setInterval(() => {
            if (context.runtime.statusCenter.workflow.terminated) {
                abort.abort();
            }
        }, 200);

        try {
            const result = await workflowRuntimeWebhookExecutor({
                userId: getWorkflowRuntimeUserId(context),
                runtimeContext: getWorkflowRuntimeContext(context),
                node: {
                    id: context.node.id,
                    type: context.node.type,
                    data: isRecord(context.node.data) ? context.node.data : undefined,
                },
                inputs: context.inputs,
                signal: abort.signal,
            });
            if (context.runtime.statusCenter.workflow.terminated) {
                return { outputs: {} };
            }
            return {
                outputs: result.outputs ?? {},
                branch: result.branch,
            };
        } catch (error) {
            if (context.runtime.statusCenter.workflow.terminated) {
                return { outputs: {} };
            }
            throw error;
        } finally {
            clearInterval(timer);
        }
    }
}

function getWorkflowRuntimeUserId(context: ExecutionContext): string | undefined {
    const runtime = context.runtime as { metadata?: { userId?: unknown } };
    return typeof runtime.metadata?.userId === "string" ? runtime.metadata.userId : undefined;
}

function getWorkflowRuntimeContext(
    context: ExecutionContext,
): WebhookExecutorInput["runtimeContext"] {
    const runtime = context.runtime as { metadata?: Record<string, unknown> };
    const metadata = runtime.metadata ?? {};
    return {
        ...(typeof metadata.projectId === "string" ? { projectId: metadata.projectId } : {}),
        ...(metadata.runtimeTarget === "local" ||
        metadata.runtimeTarget === "simulator" ||
        metadata.runtimeTarget === "device"
            ? { runtimeTarget: metadata.runtimeTarget }
            : {}),
        ...(typeof metadata.simulatorSessionId === "string"
            ? { simulatorSessionId: metadata.simulatorSessionId }
            : {}),
        ...(typeof metadata.deviceId === "string" ? { deviceId: metadata.deviceId } : {}),
        ...(typeof metadata.xiaozhiAgentId === "string"
            ? { xiaozhiAgentId: metadata.xiaozhiAgentId }
            : {}),
        ...(metadata.publishedSnapshot ? { publishedSnapshot: metadata.publishedSnapshot } : {}),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
