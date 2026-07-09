import type { IVariable, VOData } from "@flowgram.ai/runtime-interface";
import { uuid } from "../../../infrastructure/utils/index.ts";

export const WorkflowRuntimeVariable = {
    create: (params: VOData<IVariable>): IVariable => ({
        id: uuid(),
        ...params,
    }),
};
