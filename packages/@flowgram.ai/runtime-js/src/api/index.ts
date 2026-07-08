/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { FlowGramAPIName } from "@flowgram.ai/runtime-interface";
import { TaskValidateAPI } from "./task-validate.ts";
import { TaskRunAPI } from "./task-run.ts";
import { TaskResultAPI } from "./task-result.ts";
import { TaskReportAPI } from "./task-report.ts";
import { TaskCancelAPI } from "./task-cancel.ts";

export { TaskRunAPI, TaskResultAPI, TaskReportAPI, TaskCancelAPI, TaskValidateAPI };

export const WorkflowRuntimeAPIs: Record<FlowGramAPIName, (i: any) => any> = {
    [FlowGramAPIName.ServerInfo]: () => {}, // TODO
    [FlowGramAPIName.TaskRun]: TaskRunAPI,
    [FlowGramAPIName.TaskReport]: TaskReportAPI,
    [FlowGramAPIName.TaskResult]: TaskResultAPI,
    [FlowGramAPIName.TaskCancel]: TaskCancelAPI,
    [FlowGramAPIName.TaskValidate]: TaskValidateAPI,
};
