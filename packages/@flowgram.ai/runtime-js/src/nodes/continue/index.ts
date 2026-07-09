import { FlowGramNode } from "@flowgram.ai/runtime-interface";
import type {
    ExecutionContext,
    ExecutionResult,
    INodeExecutor,
} from "@flowgram.ai/runtime-interface";

export class ContinueExecutor implements INodeExecutor {
    public type = FlowGramNode.Continue;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        context.runtime.cache.set("loop-continue", true);
        return {
            outputs: {},
        };
    }
}
