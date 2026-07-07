/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { IFlowValue } from "@flowgram.ai/form-materials";

import type { FlowNodeJSON, JsonSchema } from "../typings";

const EMPTY_MCP_INPUT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {},
  required: [],
};

const SUPPORTED_TYPES = new Set([
  "boolean",
  "string",
  "integer",
  "number",
  "object",
  "array",
  "map",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeType(type: unknown): string {
  const value = Array.isArray(type) ? type.find((item) => item !== "null") : type;
  if (typeof value === "string" && SUPPORTED_TYPES.has(value)) {
    return value;
  }
  return "string";
}

function normalizePropertySchema(input: unknown): JsonSchema {
  if (!isRecord(input)) {
    return { type: "string" };
  }

  const type = normalizeType(input.type);
  const schema: JsonSchema = {
    type,
  };

  if (typeof input.title === "string") {
    schema.title = input.title;
  }
  if (typeof input.description === "string") {
    schema.description = input.description;
  }
  if (Array.isArray(input.enum)) {
    schema.enum = input.enum.filter(
      (item): item is string | number => typeof item === "string" || typeof item === "number",
    );
  }
  if ("default" in input) {
    schema.default = {
      type: "constant",
      content: input.default,
    };
  }
  if (type === "object" && isRecord(input.properties)) {
    schema.properties = Object.fromEntries(
      Object.entries(input.properties).map(([key, value]) => [key, normalizePropertySchema(value)]),
    );
    if (Array.isArray(input.required)) {
      schema.required = input.required.filter((item): item is string => typeof item === "string");
    }
  }
  if (type === "array" && isRecord(input.items)) {
    schema.items = normalizePropertySchema(input.items);
  }

  return schema;
}

function createDefaultFlowValue(schema: JsonSchema): IFlowValue {
  if (schema.default && isRecord(schema.default) && schema.default.type === "constant") {
    return schema.default as IFlowValue;
  }

  switch (schema.type) {
    case "boolean":
      return { type: "constant", content: false };
    case "integer":
    case "number":
      return { type: "constant", content: 0 };
    case "object":
    case "map":
      return { type: "constant", content: {} };
    case "array":
      return { type: "constant", content: [] };
    case "string":
    default:
      return { type: "template", content: "" };
  }
}

export function createMcpToolInputsSchema(inputSchema?: Record<string, unknown>): JsonSchema {
  if (!isRecord(inputSchema) || !isRecord(inputSchema.properties)) {
    return structuredClone(EMPTY_MCP_INPUT_SCHEMA);
  }

  const properties = Object.fromEntries(
    Object.entries(inputSchema.properties).map(([key, value]) => [
      key,
      normalizePropertySchema(value),
    ]),
  );
  const required = Array.isArray(inputSchema.required)
    ? inputSchema.required.filter((item): item is string => typeof item === "string")
    : [];

  return {
    type: "object",
    properties,
    required,
  };
}

export function createMcpInputsValues(
  inputsSchema: JsonSchema,
  previousValues: Record<string, IFlowValue> = {},
): Record<string, IFlowValue> {
  const properties = inputsSchema.properties ?? {};

  return Object.fromEntries(
    Object.entries(properties).map(([key, schema]) => [
      key,
      previousValues[key] ?? createDefaultFlowValue(schema),
    ]),
  );
}

export function createMcpOutputsSchema(): NonNullable<FlowNodeJSON["data"]["outputs"]> {
  return {
    type: "object",
    properties: {
      text: { type: "string" },
      result: { type: "object" },
      content: {
        type: "array",
        items: { type: "object" },
      },
      isError: { type: "boolean" },
    },
  };
}

export function createEmptyMcpInputsSchema(): JsonSchema {
  return structuredClone(EMPTY_MCP_INPUT_SCHEMA);
}
