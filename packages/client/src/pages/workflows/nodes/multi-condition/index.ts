/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */
import { nanoid } from "nanoid";

import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import iconCondition from "../../assets/icon-condition.svg";

import { formMeta } from "./form-meta";

let index = 0;
export const MultiConditionNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.MultiCondition,
  info: {
    icon: iconCondition,
    description: "按多组条件连接下游分支，满足条件时只执行对应分支。",
  },
  meta: {
    nodePanelLabel: "多条件分支",
    defaultPorts: [{ type: "input" }],
    // Condition Outputs use dynamic port
    useDynamicPort: true,
    expandable: false, // disable expanded
    size: {
      width: 360,
      height: 210,
    },
  },
  formMeta,
  onAdd() {
    return {
      id: `multi_condition_${nanoid(5)}`,
      type: "condition",
      data: {
        title: `多条件_${++index}`,
        branch: [
          {
            logic: "and",
            conditions: [
              {
                key: `condition_${nanoid(5)}`,
                value: {},
              },
            ],
          },
        ],
      },
    };
  },
};
