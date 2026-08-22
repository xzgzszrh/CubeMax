import type { FlowGramNode } from "@flowgram.ai/runtime-interface";
import type {
    ExecutionContext,
    ExecutionResult,
    IExecutor,
    INodeExecutor,
    INodeExecutorFactory,
} from "@flowgram.ai/runtime-interface";

export class WorkflowRuntimeExecutor implements IExecutor {
    private nodeExecutors: Map<FlowGramNode, INodeExecutor> = new Map();

    constructor(nodeExecutors: INodeExecutorFactory[]) {
        // register node executors
        nodeExecutors.forEach((executor) => {
            this.register(new executor());
        });
    }

    public register(executor: INodeExecutor): void {
        this.nodeExecutors.set(executor.type, executor);
    }

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        const nodeType = context.node.type;
        const nodeExecutor = this.getExecutor(nodeType);
        if (!nodeExecutor) {
            throw new Error(`No executor found for node type ${nodeType}`);
        }
        const output = await nodeExecutor.execute(context);
        return output;
    }

    private getExecutor(nodeType: FlowGramNode): INodeExecutor | undefined {
        const direct = this.nodeExecutors.get(nodeType);
        if (direct) return direct;
        // "我的模块" nodes are per-module types that run the same Lua runtime.
        if (typeof nodeType === "string" && nodeType.startsWith("user_lua_")) {
            return this.nodeExecutors.get("lua" as FlowGramNode);
        }
        return undefined;
    }
}
