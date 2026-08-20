/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import iconEmbedded from "../../assets/icon-embedded.svg";
import type { FlowNodeRegistry } from "../../typings";
import {
  createMcpInputsValues,
  createMcpOutputsSchema,
  createMcpToolInputsSchema,
} from "../../utils/mcp-schema";
import {
  EMBEDDED_MCP_SERVICE_KEY,
  EMBEDDED_NODE_DEFINITIONS,
  type EmbeddedNodeDefinition,
} from "./definitions";
import { formMeta } from "./form-meta";

const counters = new Map<string, number>();

function nextTitle(definition: EmbeddedNodeDefinition): string {
  const next = (counters.get(definition.type) ?? 0) + 1;
  counters.set(definition.type, next);
  return `${definition.title}_${next}`;
}

function createEmbeddedNodeRegistry(definition: EmbeddedNodeDefinition): FlowNodeRegistry {
  return {
    type: definition.type,
    info: {
      icon: iconEmbedded,
      description: definition.description,
    },
    meta: {
      size: {
        width: 320,
        height: 390,
      },
      nodePanelLabel: definition.label,
      nodePanelGroup: definition.group,
      nodePanelGroupLabel: definition.groupLabel,
    },
    onAdd() {
      const inputs = createMcpToolInputsSchema(definition.inputSchema);

      return {
        id: `${definition.type}_${nanoid(5)}`,
        type: definition.type,
        data: {
          title: nextTitle(definition),
          embeddedAction: definition.action,
          embeddedServiceKey: EMBEDDED_MCP_SERVICE_KEY,
          toolName: definition.action,
          toolInputSchema: definition.inputSchema,
          inputs,
          inputsValues: createMcpInputsValues(inputs),
          outputs: createMcpOutputsSchema(),
          timeoutMs: 60000,
          failOnToolError: true,
        },
      };
    },
    formMeta,
  };
}

export const EmbeddedNodeRegistries: FlowNodeRegistry[] = EMBEDDED_NODE_DEFINITIONS.map(
  createEmbeddedNodeRegistry,
);
