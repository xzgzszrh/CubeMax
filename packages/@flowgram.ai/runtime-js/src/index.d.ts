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
    xiaozhiAgentId?: string;
    publishedSnapshot?: unknown;
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

export type AgentExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
    node: { id: string; type: string; data?: Record<string, unknown> };
    inputs: Record<string, unknown>;
};

export type AgentExecutorHandler = (
    input: AgentExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export declare const registerAgentExecutor: (executor: AgentExecutorHandler) => void;

export type WaitExecutorInput = {
    userId?: string;
    runtimeContext?: WorkflowRuntimeExecutorContext;
    node: { id: string; type: string; data?: Record<string, unknown> };
    inputs: Record<string, unknown>;
    signal?: AbortSignal;
};

export type WaitExecutorResult = {
    outputs: Record<string, unknown>;
    branch: "continue" | "timeout";
};

export type WaitExecutorHandler = (
    input: WaitExecutorInput,
) => Promise<WaitExecutorResult> | WaitExecutorResult;

export declare const registerWaitExecutor: (executor: WaitExecutorHandler) => void;
