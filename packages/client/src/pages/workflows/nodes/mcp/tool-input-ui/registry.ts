import type {
  FlowValueBooleanUi,
  FlowValueInputUi,
  FlowValueSelectOption,
  FlowValueSelectUi,
} from "../../../form-components/form-inputs/flow-value-input";
import type { JsonSchema } from "../../../typings";

export type McpSelectOption = FlowValueSelectOption;
export type McpSelectInputUi = FlowValueSelectUi;
export type McpBooleanInputUi = FlowValueBooleanUi;
export type McpToolInputUi = FlowValueInputUi;

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
  "embedded:open_serial": {
    parity: {
      control: "select",
      options: [
        { label: "无校验", value: "none" },
        { label: "偶校验", value: "even" },
        { label: "奇校验", value: "odd" },
        { label: "标记校验", value: "mark" },
        { label: "空格校验", value: "space" },
      ],
      placeholder: "请选择校验位",
    },
  },
  "embedded:reset_device": {
    strategy: {
      control: "select",
      options: [
        { label: "DTR 信号", value: "dtr" },
        { label: "RTS 信号", value: "rts" },
        { label: "进入引导程序", value: "bootloader" },
        { label: "发送复位命令", value: "command" },
        { label: "调试探针", value: "probe" },
      ],
      placeholder: "请选择复位策略",
    },
  },
  "embedded:serial_write_text": {
    lineEnding: {
      control: "select",
      options: [
        { label: "不追加", value: "none" },
        { label: "换行符（LF）", value: "lf" },
        { label: "回车换行（CRLF）", value: "crlf" },
        { label: "回车符（CR）", value: "cr" },
      ],
      placeholder: "请选择行尾",
    },
  },
  "embedded:gpio_set_mode": {
    mode: {
      control: "select",
      options: [
        { label: "输入", value: "input" },
        { label: "输出", value: "output" },
        { label: "上拉输入", value: "input_pullup" },
        { label: "下拉输入", value: "input_pulldown" },
        { label: "模拟输入", value: "analog" },
        { label: "PWM 输出", value: "pwm" },
      ],
      placeholder: "请选择引脚模式",
    },
  },
  "embedded:save_serial_log": {
    format: {
      control: "select",
      options: [
        { label: "纯文本", value: "text" },
        { label: "JSON Lines", value: "jsonl" },
        { label: "CSV", value: "csv" },
      ],
      placeholder: "请选择日志格式",
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
    trueLabel: "是",
    falseLabel: "否",
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
