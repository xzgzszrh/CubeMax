import { FlowGramNode } from "@flowgram.ai/runtime-interface";
import type {
    ExecutionContext,
    ExecutionResult,
    INodeExecutor,
} from "@flowgram.ai/runtime-interface";

export class StartExecutor implements INodeExecutor {
    public readonly type = FlowGramNode.Start;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        return {
            outputs: context.runtime.ioCenter.inputs,
        };
    }
}
