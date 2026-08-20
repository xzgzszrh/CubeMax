/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import iconContinue from "../../assets/icon-continue.jpg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;
export const ContinueNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Continue,
  meta: {
    nodePanelLabel: "继续循环",
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
    icon: iconContinue,
    description: "跳过本次循环剩余步骤，继续下一次循环。",
  },
  /**
   * Render node via formMeta
   */
  formMeta,
  onAdd() {
    return {
      id: `continue_${nanoid(5)}`,
      type: "continue",
      data: {
        title: `继续循环_${++index}`,
      },
    };
  },
};
