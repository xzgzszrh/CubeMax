/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { IFlowValue } from "@flowgram.ai/form-materials";

import type { FlowDocumentJSON, FlowNodeJSON } from "../typings";

type WorkflowNodeWithBlocks = FlowNodeJSON & {
  blocks?: FlowNodeJSON[];
};

const LLM_INPUTS_SCHEMA: NonNullable<FlowNodeJSON["data"]["inputs"]> = {
  type: "object",
  required: ["modelId", "temperature", "prompt"],
  properties: {
    modelId: {
      type: "string",
      title: "模型",
      description: "选择用于生成回复的大语言模型。",
      extra: {
        formComponent: "llm-model-select",
      },
    },
    temperature: {
      type: "number",
      title: "温度",
      description: "控制生成结果的随机性，数值越高越发散。",
    },
    systemPrompt: {
      type: "string",
      title: "系统提示词",
      description: "用于设定模型角色和行为边界。",
      extra: {
        formComponent: "prompt-editor",
      },
    },
    prompt: {
      type: "string",
      title: "用户提示词",
      description: "发送给模型的主要输入内容。",
      extra: {
        formComponent: "prompt-editor",
      },
    },
  },
};

export function createLLMInputsSchema(): NonNullable<FlowNodeJSON["data"]["inputs"]> {
  return structuredClone(LLM_INPUTS_SCHEMA);
}

export function createLLMInputsValues(
  inputsValues: Record<string, IFlowValue> = {},
): Record<string, IFlowValue> {
  return {
    modelId: inputsValues.modelId ?? {
      type: "constant",
      content: "",
    },
    temperature: inputsValues.temperature ?? {
      type: "constant",
      content: 0.5,
    },
    systemPrompt: inputsValues.systemPrompt ?? {
      type: "template",
      content: "# 角色\n你是一个 AI 助手。\n",
    },
    prompt: inputsValues.prompt ?? {
      type: "template",
      content: "",
    },
  };
}

function normalizeLLMNode(node: FlowNodeJSON): FlowNodeJSON {
  return {
    ...node,
    data: {
      ...node.data,
      inputsValues: createLLMInputsValues(node.data.inputsValues),
      inputs: createLLMInputsSchema(),
    },
  };
}

function normalizeWorkflowNode(node: FlowNodeJSON): FlowNodeJSON {
  const normalizedNode = node.type === "llm" ? normalizeLLMNode(node) : node;
  const blocks = (normalizedNode as WorkflowNodeWithBlocks).blocks;

  if (!Array.isArray(blocks)) {
    return normalizedNode;
  }

  return {
    ...normalizedNode,
    blocks: blocks.map(normalizeWorkflowNode),
  } as FlowNodeJSON;
}

export function normalizeWorkflowSchema(schema: FlowDocumentJSON): FlowDocumentJSON {
  return {
    ...schema,
    nodes: schema.nodes.map(normalizeWorkflowNode),
  };
}
