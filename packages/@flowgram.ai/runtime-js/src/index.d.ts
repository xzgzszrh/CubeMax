import type {
    FlowGramAPIName,
    TaskCancelInput,
    TaskCancelOutput,
    TaskReportInput,
    TaskReportOutput,
    TaskResultInput,
    TaskResultOutput,
    TaskRunInput,
    TaskRunOutput,
    TaskValidateInput,
    TaskValidateOutput,
} from "@flowgram.ai/runtime-interface";

export type WorkflowRuntimeContextInput = {
    userId?: string;
    [key: string]: unknown;
};

export type WorkflowRuntimeTaskValidateInput = TaskValidateInput & {
    context?: WorkflowRuntimeContextInput;
};

export type WorkflowRuntimeTaskRunInput = TaskRunInput & {
    context?: WorkflowRuntimeContextInput;
};

export declare const TaskValidateAPI: (
    input: WorkflowRuntimeTaskValidateInput,
) => Promise<TaskValidateOutput>;
export declare const TaskRunAPI: (input: WorkflowRuntimeTaskRunInput) => Promise<TaskRunOutput>;
export declare const TaskResultAPI: (input: TaskResultInput) => Promise<TaskResultOutput>;
export declare const TaskReportAPI: (input: TaskReportInput) => Promise<TaskReportOutput>;
export declare const TaskCancelAPI: (input: TaskCancelInput) => Promise<TaskCancelOutput>;

export declare const WorkflowRuntimeAPIs: Record<FlowGramAPIName, (input: any) => any>;

export type LLMExecutorInput = {
    userId?: string;
    node: {
        id: string;
        type: string;
        data?: Record<string, unknown>;
    };
    inputs: Record<string, unknown>;
};

export type LLMExecutorHandler = (
    input: LLMExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export declare const registerLLMExecutor: (executor: LLMExecutorHandler) => void;

export type WorkflowRuntimeExecutorContext = {
    projectId?: string;
    runtimeTarget?: "local" | "simulator" | "device";
    simulatorSessionId?: string;
    deviceId?: string;
    publishedSnapshot?: unknown;
    installationId?: string;
    workflowTaskId?: string;
};

export type MCPExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
    node: {
        id: string;
        type: string;
        data?: Record<string, unknown>;
    };
    inputs: Record<string, unknown>;
};

export type MCPExecutorHandler = (
    input: MCPExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export declare const registerMCPExecutor: (executor: MCPExecutorHandler) => void;

export type LuaExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
    node: { id: string; type: string; data?: Record<string, unknown> };
    inputs: Record<string, unknown>;
};

export type LuaExecutorHandler = (
    input: LuaExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export declare const registerLuaExecutor: (executor: LuaExecutorHandler) => void;

export type SmartHomeExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
    node: { id: string; type: string; data?: Record<string, unknown> };
    inputs: Record<string, unknown>;
};

export type SmartHomeExecutorHandler = (
    input: SmartHomeExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export declare const registerSmartHomeExecutor: (executor: SmartHomeExecutorHandler) => void;

export type PhoneCameraExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
    node: { id: string; type: string; data?: Record<string, unknown> };
    inputs: Record<string, unknown>;
};

export type PhoneCameraExecutorHandler = (
    input: PhoneCameraExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export declare const registerPhoneCameraExecutor: (executor: PhoneCameraExecutorHandler) => void;

export declare const onTaskSettled: (taskID: string, cb: () => void) => boolean;
