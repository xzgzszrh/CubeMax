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

export type PhoneCameraExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
    node: { id: string; type: string; data?: Record<string, unknown> };
    inputs: Record<string, unknown>;
};

export type PhoneCameraExecutorHandler = (
    input: PhoneCameraExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

let workflowRuntimePhoneCameraExecutor: PhoneCameraExecutorHandler | undefined;

export const registerPhoneCameraExecutor = (executor: PhoneCameraExecutorHandler): void => {
    workflowRuntimePhoneCameraExecutor = executor;
};

export class PhoneCameraExecutor implements INodeExecutor {
    public readonly type = "phone_camera" as FlowGramNode;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        if (!workflowRuntimePhoneCameraExecutor) {
            throw new Error("Phone camera executor is not registered");
        }
        const outputs = await workflowRuntimePhoneCameraExecutor({
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
