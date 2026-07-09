import type { IReport, VOData } from "@flowgram.ai/runtime-interface";
import { uuid } from "../../../infrastructure/utils/index.ts";

export const WorkflowRuntimeReport = {
    create: (params: VOData<IReport>): IReport => ({
        id: uuid(),
        ...params,
    }),
};
