/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { FlowNodeRegistry } from "../typings";
import { BlockEndNodeRegistry } from "./block-end";
import { BlockStartNodeRegistry } from "./block-start";
import { BreakNodeRegistry } from "./break";
import { CodeNodeRegistry } from "./code";
import { CommentNodeRegistry } from "./comment";
import { ConditionNodeRegistry } from "./condition";
import { ContinueNodeRegistry } from "./continue";
import { EndNodeRegistry } from "./end";
import { GroupNodeRegistry } from "./group";
import { HTTPNodeRegistry } from "./http";
import { LLMNodeRegistry } from "./llm";
import { LoopNodeRegistry } from "./loop";
import { MCPNodeRegistry } from "./mcp";
import { MultiConditionNodeRegistry } from "./multi-condition";
import { StartNodeRegistry } from "./start";
import { VariableNodeRegistry } from "./variable";
export { WorkflowNodeType } from "./constants";

export const nodeRegistries: FlowNodeRegistry[] = [
  ConditionNodeRegistry,
  StartNodeRegistry,
  EndNodeRegistry,
  LLMNodeRegistry,
  MCPNodeRegistry,
  LoopNodeRegistry,
  CommentNodeRegistry,
  BlockStartNodeRegistry,
  BlockEndNodeRegistry,
  HTTPNodeRegistry,
  CodeNodeRegistry,
  ContinueNodeRegistry,
  BreakNodeRegistry,
  VariableNodeRegistry,
  GroupNodeRegistry,
  MultiConditionNodeRegistry,
];
