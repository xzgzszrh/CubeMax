import type { TaskCancelInput, TaskCancelOutput } from "@flowgram.ai/runtime-interface";
import { WorkflowApplication } from "../application/workflow.ts";

export const TaskCancelAPI = async (input: TaskCancelInput): Promise<TaskCancelOutput> => {
    const app = WorkflowApplication.instance;
    const { taskID } = input;
    const success = app.cancel(taskID);
    const output: TaskCancelOutput = {
        success,
    };
    return output;
};
