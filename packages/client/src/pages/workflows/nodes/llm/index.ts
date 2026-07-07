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
    description:
      "Call the large language model and use variables and prompt words to generate responses.",
  },
  meta: {
    size: {
      width: 360,
      height: 390,
    },
  },
  onAdd() {
    return {
      id: `llm_${nanoid(5)}`,
      type: "llm",
      data: {
        title: `LLM_${++index}`,
        inputsValues: createLLMInputsValues(),
        inputs: createLLMInputsSchema(),
        outputs: {
          type: "object",
          properties: {
            result: { type: "string" },
          },
        },
      },
    };
  },
};
