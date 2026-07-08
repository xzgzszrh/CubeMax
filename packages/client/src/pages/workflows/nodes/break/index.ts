/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import type { FlowNodeRegistry } from "../../typings";
import iconBreak from "../../assets/icon-break.jpg";
import { formMeta } from "./form-meta";
import { WorkflowNodeType } from "../constants";

let index = 0;
export const BreakNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Break,
  meta: {
    nodePanelLabel: "跳出循环",
    defaultPorts: [{ type: "input" }],
    sidebarDisabled: true,
    size: {
      width: 360,
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
