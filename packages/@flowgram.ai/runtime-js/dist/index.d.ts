declare enum FlowGramAPIName {
    ServerInfo = "ServerInfo",
    TaskRun = "TaskRun",
    TaskReport = "TaskReport",
    TaskResult = "TaskResult",
    TaskCancel = "TaskCancel",
    TaskValidate = "TaskValidate"
}

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
type WorkflowInputs = Record<string, any>;
type WorkflowOutputs = Record<string, any>;

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

interface ValidationResult {
    valid: boolean;
    errors?: string[];
}

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
declare enum WorkflowStatus {
    Pending = "pending",
    Processing = "processing",
    Succeeded = "succeeded",
    Failed = "failed",
    Cancelled = "canceled"
}
interface StatusData {
    status: WorkflowStatus;
    terminated: boolean;
    startTime: number;
    endTime?: number;
    timeCost: number;
}

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

interface SnapshotData {
    nodeID: string;
    inputs: WorkflowInputs;
    outputs: WorkflowOutputs;
    data: any;
    branch?: string;
    error?: string;
}
interface Snapshot extends SnapshotData {
    id: string;
}

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
declare enum WorkflowMessageType {
    Log = "log",
    Info = "info",
    Debug = "debug",
    Error = "error",
    Warn = "warning"
}
interface MessageData {
    message: string;
    nodeID?: string;
    timestamp?: number;
}
interface IMessage extends MessageData {
    id: string;
    type: WorkflowMessageType;
    timestamp: number;
}
type WorkflowMessages = Record<WorkflowMessageType, IMessage[]>;

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

interface NodeReport extends StatusData {
    id: string;
    snapshots: Snapshot[];
}
type WorkflowReports = Record<string, NodeReport>;
interface IReport {
    id: string;
    inputs: WorkflowInputs;
    outputs: WorkflowOutputs;
    workflowStatus: StatusData;
    reports: WorkflowReports;
    messages: WorkflowMessages;
}

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

interface TaskRunInput {
    inputs: WorkflowInputs;
    schema: string;
    context?: WorkflowRuntimeTaskContext;
}
interface TaskRunOutput {
    taskID: string;
}

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

interface TaskReportInput {
    taskID: string;
}
type TaskReportOutput = IReport | undefined;

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

interface TaskValidateInput {
    inputs: WorkflowInputs;
    schema: string;
    context?: WorkflowRuntimeTaskContext;
}
interface TaskValidateOutput extends ValidationResult {
}

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

interface TaskResultInput {
    taskID: string;
}
type TaskResultOutput = WorkflowOutputs | undefined;

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

interface TaskCancelInput {
    taskID: string;
}
type TaskCancelOutput = {
    success: boolean;
};

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

declare const TaskValidateAPI: (input: TaskValidateInput) => Promise<TaskValidateOutput>;

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

declare const TaskRunAPI: (input: TaskRunInput) => Promise<TaskRunOutput>;

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

declare const TaskResultAPI: (input: TaskResultInput) => Promise<TaskResultOutput>;

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

declare const TaskReportAPI: (input: TaskReportInput) => Promise<TaskReportOutput>;

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

declare const TaskCancelAPI: (input: TaskCancelInput) => Promise<TaskCancelOutput>;

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

declare const WorkflowRuntimeAPIs: Record<FlowGramAPIName, (i: any) => any>;

interface WorkflowRuntimeTaskContext {
    userId?: string;
    [key: string]: unknown;
}
interface WorkflowMCPExecutorInput {
    userId?: string;
    node: {
        id: string;
        type: string;
        data?: Record<string, unknown>;
    };
    inputs: WorkflowInputs;
}
type WorkflowMCPExecutor = (input: WorkflowMCPExecutorInput) => Promise<WorkflowOutputs> | WorkflowOutputs;
declare const registerMCPExecutor: (executor: WorkflowMCPExecutor) => void;

export { TaskCancelAPI, TaskReportAPI, TaskResultAPI, TaskRunAPI, TaskValidateAPI, WorkflowRuntimeAPIs, registerMCPExecutor };
