/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import iconCondition from "../../assets/icon-condition.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

export const ConditionNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Condition,
  info: {
    icon: iconCondition,
    description: "连接多个下游分支，满足条件时只执行对应分支。",
  },
  meta: {
    nodePanelLabel: "条件分支",
    defaultPorts: [{ type: "input" }],
    // Condition Outputs use dynamic port
    useDynamicPort: true,
    expandable: false, // disable expanded
    size: {
      width: 320,
      height: 210,
    },
  },
  formMeta,
  onAdd() {
    return {
      id: `condition_${nanoid(5)}`,
      type: "condition",
      data: {
        title: "条件分支",
        conditions: [
          {
            key: `if_${nanoid(5)}`,
            value: {},
          },
          {
            key: `if_${nanoid(5)}`,
            value: {},
          },
        ],
      },
    };
  },
};
