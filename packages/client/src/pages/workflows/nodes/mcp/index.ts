/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import iconMCP from "../../assets/icon-mcp.svg";
import type { FlowNodeRegistry } from "../../typings";
import { createEmptyMcpInputsSchema, createMcpOutputsSchema } from "../../utils/mcp-schema";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const MCPNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.MCP,
  info: {
    icon: iconMCP,
    description: "Execute a selected tool from an MCP server.",
  },
  meta: {
    size: {
      width: 360,
      height: 390,
    },
  },
  onAdd() {
    return {
      id: `mcp_${nanoid(5)}`,
      type: WorkflowNodeType.MCP,
      data: {
        title: `MCP_${++index}`,
        mcpServerId: "",
        toolName: "",
        toolInputSchema: {},
        inputs: createEmptyMcpInputsSchema(),
        inputsValues: {},
        outputs: createMcpOutputsSchema(),
        timeoutMs: 60000,
        failOnToolError: true,
      },
    };
  },
  formMeta,
};
