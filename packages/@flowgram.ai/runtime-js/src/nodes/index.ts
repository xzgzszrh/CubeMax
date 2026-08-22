import type { INodeExecutorFactory } from "@flowgram.ai/runtime-interface";
import { StartExecutor } from "./start/index.ts";
import { LoopExecutor } from "./loop/index.ts";
import { LLMExecutor } from "./llm/index.ts";
import { MCPExecutor } from "./mcp/index.ts";
import { HTTPExecutor } from "./http/index.ts";
import { EndExecutor } from "./end/index.ts";
import { BlockEndExecutor, BlockStartExecutor } from "./empty/index.ts";
import { ContinueExecutor } from "./continue/index.ts";
import { ConditionExecutor } from "./condition/index.ts";
import { CodeExecutor } from "./code/index.ts";
import { BreakExecutor } from "./break/index.ts";
import { LuaExecutor } from "./lua/index.ts";
import { AgentExecutor } from "./agent/index.ts";
import { WaitExecutor } from "./wait/index.ts";

export const WorkflowRuntimeNodeExecutors: INodeExecutorFactory[] = [
    StartExecutor,
    EndExecutor,
    LLMExecutor,
    MCPExecutor,
    ConditionExecutor,
    LoopExecutor,
    BlockStartExecutor,
    BlockEndExecutor,
    HTTPExecutor,
    CodeExecutor,
    LuaExecutor,
    AgentExecutor,
    WaitExecutor,
    BreakExecutor,
    ContinueExecutor,
];
