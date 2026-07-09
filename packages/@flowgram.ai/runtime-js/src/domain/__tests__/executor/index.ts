import type { INodeExecutorFactory } from "@flowgram.ai/runtime-interface";
import { StartExecutor } from "../../../nodes/start/index.ts";
import { EndExecutor } from "../../../nodes/end/index.ts";
import { ConditionExecutor } from "../../../nodes/condition/index.ts";
import { MockLLMExecutor } from "./llm.ts";

export const MockWorkflowRuntimeNodeExecutors: INodeExecutorFactory[] = [
    StartExecutor,
    EndExecutor,
    MockLLMExecutor,
    ConditionExecutor,
];
