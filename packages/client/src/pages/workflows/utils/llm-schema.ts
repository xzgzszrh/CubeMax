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
      extra: {
        formComponent: "llm-model-select",
      },
    },
    temperature: {
      type: "number",
    },
    systemPrompt: {
      type: "string",
      extra: {
        formComponent: "prompt-editor",
      },
    },
    prompt: {
      type: "string",
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
      content: "# Role\nYou are an AI assistant.\n",
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
