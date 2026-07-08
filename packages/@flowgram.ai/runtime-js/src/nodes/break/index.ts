import { FlowGramNode } from "@flowgram.ai/runtime-interface";
import type {
    ExecutionContext,
    ExecutionResult,
    INodeExecutor,
} from "@flowgram.ai/runtime-interface";

export class BreakExecutor implements INodeExecutor {
    public type = FlowGramNode.Break;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        context.runtime.cache.set("loop-break", true);
        return {
            outputs: {},
        };
    }
}
