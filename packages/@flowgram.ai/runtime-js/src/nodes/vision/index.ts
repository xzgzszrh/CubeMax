import type {
    ExecutionContext,
    ExecutionResult,
    FlowGramNode,
    INodeExecutor,
} from "@flowgram.ai/runtime-interface";

import {
    getWorkflowRuntimeUserId,
    readRuntimeMetadata,
    type WorkflowRuntimeExecutorContext,
} from "../runtime-metadata.ts";

export type VisionExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
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
            userId: getWorkflowRuntimeUserId(context),
            runtimeContext: readRuntimeMetadata(context),
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
