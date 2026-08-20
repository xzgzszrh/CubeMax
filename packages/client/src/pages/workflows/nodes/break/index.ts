/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import iconBreak from "../../assets/icon-break.jpg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;
export const BreakNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Break,
  meta: {
    nodePanelLabel: "跳出循环",
    defaultPorts: [{ type: "input" }],
    sidebarDisabled: true,
    size: {
      width: 320,
      height: 54,
    },
    expandable: false,
    onlyInContainer: WorkflowNodeType.Loop,
  },
  info: {
    icon: iconBreak,
    description: "在循环中提前结束整个循环。",
  },
  /**
   * Render node via formMeta
   */
  formMeta,
  onAdd() {
    return {
      id: `break_${nanoid(5)}`,
      type: "break",
      data: {
        title: `跳出循环_${++index}`,
      },
    };
  },
};
