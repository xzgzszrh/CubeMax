/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IExecutor } from "@flowgram.ai/runtime-interface";
import { MockLLMExecutor } from "./executor/llm.ts";
import { WorkflowRuntimeContainer } from "../container/index.ts";

const container = WorkflowRuntimeContainer.instance;
const executor = container.get<IExecutor>(IExecutor);
executor.register(new MockLLMExecutor());
