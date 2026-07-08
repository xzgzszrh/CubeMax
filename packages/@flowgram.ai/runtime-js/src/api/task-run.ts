import type { TaskRunInput, TaskRunOutput } from "@flowgram.ai/runtime-interface";
import { WorkflowApplication } from "../application/workflow.ts";
import type { WorkflowRuntimeContextInput } from "../application/workflow.ts";

export type WorkflowRuntimeTaskRunInput = TaskRunInput & {
    context?: WorkflowRuntimeContextInput;
};

export const TaskRunAPI = async (input: WorkflowRuntimeTaskRunInput): Promise<TaskRunOutput> => {
    const app = WorkflowApplication.instance;
    const { schema: stringSchema, inputs, context } = input;
    const schema = JSON.parse(stringSchema);
    const taskID = app.run({
        schema,
        inputs,
        context,
    });
    const output: TaskRunOutput = {
        taskID,
    };
    return output;
};
