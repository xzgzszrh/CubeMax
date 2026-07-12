import type { JsonSchema } from "../../../typings";

export interface McpSelectOption {
  label: string;
  value: string | number;
}

export interface McpSelectInputUi {
  control: "select";
  options: McpSelectOption[];
  placeholder?: string;
  showClear?: boolean;
}

export interface McpBooleanInputUi {
  control: "boolean";
  trueLabel?: string;
  falseLabel?: string;
}

export type McpToolInputUi = McpSelectInputUi | McpBooleanInputUi;

type McpToolUiDefinition = Record<string, McpToolInputUi>;

const TOOL_UI_REGISTRY: Record<string, McpToolUiDefinition> = {
  "tavily:tavily_search": {
    search_depth: {
      control: "select",
      options: [
        { label: "基础", value: "basic" },
        { label: "高级", value: "advanced" },
        { label: "快速", value: "fast" },
        { label: "极速", value: "ultra-fast" },
      ],
      placeholder: "请选择搜索深度",
    },
    topic: {
      control: "select",
      options: [
        { label: "通用", value: "general" },
        { label: "新闻", value: "news" },
        { label: "财经", value: "finance" },
      ],
      placeholder: "请选择搜索主题",
    },
    time_range: {
      control: "select",
      options: [
        { label: "最近一天", value: "day" },
        { label: "最近一周", value: "week" },
        { label: "最近一个月", value: "month" },
        { label: "最近一年", value: "year" },
      ],
      placeholder: "不指定",
      showClear: true,
    },
  },
  "tavily:tavily_extract": {
    extract_depth: {
      control: "select",
      options: [
        { label: "基础", value: "basic" },
        { label: "高级", value: "advanced" },
      ],
      placeholder: "请选择提取深度",
    },
    format: {
      control: "select",
      options: [
        { label: "Markdown", value: "markdown" },
        { label: "纯文本", value: "text" },
      ],
      placeholder: "请选择输出格式",
    },
  },
};

function createGenericEnumUi(schema: JsonSchema): McpSelectInputUi | undefined {
  const values = schema.enum?.filter(
    (value): value is string | number => typeof value === "string" || typeof value === "number",
  );

  if (!values?.length) return undefined;

  return {
    control: "select",
    options: values.map((value) => ({ label: String(value), value })),
    placeholder: "请选择",
    showClear: true,
  };
}

function createGenericBooleanUi(schema: JsonSchema): McpBooleanInputUi | undefined {
  if (schema.type !== "boolean") return undefined;

  return {
    control: "boolean",
    trueLabel: "True",
    falseLabel: "False",
  };
}

export function resolveMcpToolInputUi({
  serverKey,
  toolName,
  inputName,
  schema,
}: {
  serverKey?: string;
  toolName?: string;
  inputName: string;
  schema: JsonSchema;
}): McpToolInputUi | undefined {
  const registryKey = serverKey && toolName ? `${serverKey}:${toolName}` : undefined;
  const specializedUi = registryKey ? TOOL_UI_REGISTRY[registryKey]?.[inputName] : undefined;

  return specializedUi ?? createGenericBooleanUi(schema) ?? createGenericEnumUi(schema);
}
