import type { TaskValidateInput, TaskValidateOutput } from "@flowgram.ai/runtime-interface";
import { WorkflowApplication } from "../application/workflow.ts";
import type { WorkflowRuntimeContextInput } from "../application/workflow.ts";

export type WorkflowRuntimeTaskValidateInput = TaskValidateInput & {
    context?: WorkflowRuntimeContextInput;
};

export const TaskValidateAPI = async (
    input: WorkflowRuntimeTaskValidateInput,
): Promise<TaskValidateOutput> => {
    const app = WorkflowApplication.instance;
    const { schema: stringSchema, inputs, context } = input;
    const schema = JSON.parse(stringSchema);
    const result = app.validate({
        schema,
        inputs,
        context,
    });
    const output: TaskValidateOutput = result;
    return output;
};
