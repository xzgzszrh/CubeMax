import { FlowGramNode } from "@flowgram.ai/runtime-interface";
import type {
    ExecutionContext,
    ExecutionResult,
    INodeExecutor,
} from "@flowgram.ai/runtime-interface";

export class BlockStartExecutor implements INodeExecutor {
    public readonly type = FlowGramNode.BlockStart;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        return {
            outputs: {},
        };
    }
}

export class BlockEndExecutor implements INodeExecutor {
    public type = FlowGramNode.BlockEnd;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        return {
            outputs: {},
        };
    }
}
