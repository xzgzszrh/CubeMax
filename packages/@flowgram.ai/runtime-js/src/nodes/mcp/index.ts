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

export type MCPExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
    node: {
        id: string;
        type: string;
        data?: Record<string, unknown>;
    };
    inputs: Record<string, unknown>;
};

export type MCPExecutorHandler = (
    input: MCPExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

let workflowRuntimeMCPExecutor: MCPExecutorHandler | undefined;

export const registerMCPExecutor = (executor: MCPExecutorHandler): void => {
    workflowRuntimeMCPExecutor = executor;
};

export class MCPExecutor implements INodeExecutor {
    public readonly type = "mcp" as FlowGramNode;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        if (!workflowRuntimeMCPExecutor) {
            throw new Error("MCP executor is not registered");
        }

        const outputs = await workflowRuntimeMCPExecutor({
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
