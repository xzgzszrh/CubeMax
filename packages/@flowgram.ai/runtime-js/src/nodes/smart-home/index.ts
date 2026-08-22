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

export type SmartHomeExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
    node: {
        id: string;
        type: string;
        data?: Record<string, unknown>;
    };
    inputs: Record<string, unknown>;
};

export type SmartHomeExecutorHandler = (
    input: SmartHomeExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

let workflowRuntimeSmartHomeExecutor: SmartHomeExecutorHandler | undefined;

export const registerSmartHomeExecutor = (executor: SmartHomeExecutorHandler): void => {
    workflowRuntimeSmartHomeExecutor = executor;
};

export class SmartHomeExecutor implements INodeExecutor {
    public readonly type = "smart_home" as FlowGramNode;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        if (!workflowRuntimeSmartHomeExecutor) {
            throw new Error("Smart home executor is not registered");
        }

        const outputs = await workflowRuntimeSmartHomeExecutor({
            userId: getWorkflowRuntimeUserId(context),
            runtimeContext: readRuntimeMetadata(context),
            node: {
                id: context.node.id,
                type: context.node.type,
                data: isRecord(context.node.data) ? context.node.data : undefined,
            },
            inputs: context.inputs,
        });

        return {
            outputs: outputs ?? {},
        };
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
