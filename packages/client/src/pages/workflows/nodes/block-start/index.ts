/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import iconStart from "../../assets/icon-start.jpg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

export const BlockStartNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.BlockStart,
  meta: {
    nodePanelLabel: "子流程入口",
    isStart: true,
    deleteDisable: true,
    copyDisable: true,
    sidebarDisabled: true,
    nodePanelVisible: false,
    defaultPorts: [{ type: "output" }],
    size: {
      width: 100,
      height: 100,
    },
    wrapperStyle: {
      minWidth: "unset",
      width: "100%",
      borderWidth: 2,
      borderRadius: 20,
      cursor: "move",
    },
  },
  info: {
    icon: iconStart,
    description: "子流程块的开始节点。",
  },
  /**
   * Render node via formMeta
   */
  formMeta,
  /**
   * Start Node cannot be added
   */
  canAdd() {
    return false;
  },
};
