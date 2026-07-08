/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import iconComment from "../../assets/icon-comment.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";

let index = 0;

export const CommentNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Comment,
  info: {
    icon: iconComment,
    description: "在画布中添加说明文字，不参与工作流连线和运行。",
  },
  meta: {
    sidebarDisabled: true,
    nodePanelLabel: "注释",
    defaultPorts: [],
    renderKey: WorkflowNodeType.Comment,
    size: {
      width: 240,
      height: 150,
    },
  },
  formMeta: {
    render: () => <></>,
  },
  getInputPoints: () => [], // Comment 节点没有输入
  getOutputPoints: () => [], // Comment 节点没有输出
  onAdd() {
    return {
      id: `comment_${nanoid(5)}`,
      type: WorkflowNodeType.Comment,
      data: {
        title: `注释_${++index}`,
        size: {
          width: 240,
          height: 150,
        },
        note: "",
      },
    };
  },
};
