import { WorkflowStatus } from "@flowgram.ai/runtime-interface";
import type { IContext, ITask, TaskParams, WorkflowOutputs } from "@flowgram.ai/runtime-interface";
import { uuid } from "../../infrastructure/utils/index.ts";

export class WorkflowRuntimeTask implements ITask {
    public readonly id: string;

    public readonly processing: Promise<WorkflowOutputs>;

    public readonly context: IContext;

    constructor(params: TaskParams & { id?: string }) {
        this.id = params.id ?? uuid();
        this.context = params.context;
        this.processing = params.processing;
    }

    public cancel(): void {
        this.context.statusCenter.workflow.cancel();
        const cancelNodeIDs = this.context.statusCenter.getStatusNodeIDs(WorkflowStatus.Processing);
        cancelNodeIDs.forEach((nodeID) => {
            this.context.statusCenter.nodeStatus(nodeID).cancel();
        });
    }

    public static create(params: TaskParams & { id?: string }): WorkflowRuntimeTask {
        return new WorkflowRuntimeTask(params);
    }

    public static createId(): string {
        return uuid();
    }
}
