/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import iconLLM from "../../assets/icon-llm.jpg";
import type { FlowNodeRegistry } from "../../typings";
import { createLLMInputsSchema, createLLMInputsValues } from "../../utils/llm-schema";
import { WorkflowNodeType } from "../constants";

let index = 0;
export const LLMNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.LLM,
  info: {
    icon: iconLLM,
    description: "调用大语言模型，并结合变量和提示词生成回复。",
  },
  meta: {
    nodePanelLabel: "大模型",
    size: {
      width: 320,
      height: 390,
    },
  },
  onAdd() {
    return {
      id: `llm_${nanoid(5)}`,
      type: "llm",
      data: {
        title: `大模型_${++index}`,
        inputsValues: createLLMInputsValues(),
        inputs: createLLMInputsSchema(),
        outputs: {
          type: "object",
          properties: {
            result: { type: "string", title: "结果" },
          },
        },
      },
    };
  },
};
