import type {
    ExecutionContext,
    ExecutionResult,
    FlowGramNode,
    INodeExecutor,
} from "@flowgram.ai/runtime-interface";

export type LuaExecutorInput = {
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

export type LuaExecutorHandler = (
    input: LuaExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

let workflowRuntimeLuaExecutor: LuaExecutorHandler | undefined;

export const registerLuaExecutor = (executor: LuaExecutorHandler): void => {
    workflowRuntimeLuaExecutor = executor;
};

export class LuaExecutor implements INodeExecutor {
    public readonly type = "lua" as FlowGramNode;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        if (!workflowRuntimeLuaExecutor) throw new Error("Lua executor is not registered");
        const outputs = await workflowRuntimeLuaExecutor({
            userId: getWorkflowRuntimeUserId(context),
            runtimeContext: getWorkflowRuntimeContext(context),
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

function getWorkflowRuntimeUserId(context: ExecutionContext): string | undefined {
    const runtime = context.runtime as { metadata?: { userId?: unknown } };
    return typeof runtime.metadata?.userId === "string" ? runtime.metadata.userId : undefined;
}

function getWorkflowRuntimeContext(context: ExecutionContext): LuaExecutorInput["runtimeContext"] {
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
