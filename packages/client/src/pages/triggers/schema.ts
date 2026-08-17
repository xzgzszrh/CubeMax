import type { JsonSchema, ProgrammingProjectItem } from "@buildingai/services/web";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function getProjectInputSchema(project?: ProgrammingProjectItem): JsonSchema {
  const nodes = project?.mainWorkflow.schema?.nodes;
  if (!Array.isArray(nodes)) return { type: "object", properties: {} };
  const startNode = nodes.find((node) => isRecord(node) && node.type === "start");
  const data = isRecord(startNode) && isRecord(startNode.data) ? startNode.data : undefined;
  const outputs = data?.outputs;
  return isRecord(outputs) ? (outputs as JsonSchema) : { type: "object", properties: {} };
}

export function createSchemaDefaults(schema: JsonSchema): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema.properties ?? {}).flatMap(([key, property]) =>
      property.default === undefined ? [] : [[key, property.default]],
    ),
  );
}

export function getSchemaFieldLabel(name: string, schema: JsonSchema): string {
  return schema.title?.trim() || name;
}

export function formatSchemaType(schema: JsonSchema): string {
  if (Array.isArray(schema.enum) && schema.enum.length) return "选项";
  const labels: Record<string, string> = {
    array: "列表",
    boolean: "开关",
    integer: "整数",
    number: "数字",
    object: "对象",
    string: "文本",
  };
  return labels[schema.type || "string"] || "文本";
}
