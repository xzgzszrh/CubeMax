import type {
    ExecutionContext,
    ExecutionResult,
    FlowGramNode,
    INodeExecutor,
} from "@flowgram.ai/runtime-interface";

export type VisionExecutorInput = {
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
};

export type VisionExecutorHandler = (
    input: VisionExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

let workflowRuntimeVisionExecutor: VisionExecutorHandler | undefined;

export const registerVisionExecutor = (executor: VisionExecutorHandler): void => {
    workflowRuntimeVisionExecutor = executor;
};

export class VisionExecutor implements INodeExecutor {
    public readonly type = "vision" as FlowGramNode;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        if (!workflowRuntimeVisionExecutor) {
            throw new Error("Vision executor is not registered");
        }
        const outputs = await workflowRuntimeVisionExecutor({
            userId: getUserId(context),
            runtimeContext: getContext(context),
            node: {
                id: context.node.id,
                type: context.node.type,
                data: isRecord(context.node.data) ? context.node.data : undefined,
            },
            inputs: context.inputs,
        });
        return { outputs: outputs ?? {} };
    }
}

function getUserId(context: ExecutionContext): string | undefined {
    const runtime = context.runtime as { metadata?: { userId?: unknown } };
    return typeof runtime.metadata?.userId === "string" ? runtime.metadata.userId : undefined;
}

function getContext(context: ExecutionContext): VisionExecutorInput["runtimeContext"] {
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
