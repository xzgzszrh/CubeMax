/**
 * Webhook 节点表单 - 配置回传端点
 * 为 CubeCat 注册可调用的 MCP 工具，并生成可复制的提示词片段
 */

import { Button, Divider, Input, InputNumber } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";
import { Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import {
  FormContent,
  FormHeader,
  FormInputs,
  FormItem,
  ReadonlyValue,
} from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { FlowNodeJSON, JsonSchema } from "../../typings";
import { defaultFormMeta } from "../default-form-meta";

const TOOL_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

function ToolNameInput() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="toolName">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="工具名称" required type="string">
            <Input
              value={field.value ?? ""}
              onChange={(value) => field.onChange(value as string)}
              disabled={readonly}
              placeholder="例如: timer_complete"
              size="small"
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
              字母开头，只能包含字母、数字和下划线。流程跑到这里时会注册到 CubeCat。
            </div>
          </FormItem>
        ) : (
          <FormItem name="工具名称" type="string">
            <ReadonlyValue value={field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function ToolDescriptionInput() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="toolDescription">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="工具描述" type="string">
            <textarea
              className="workflow-form-textarea"
              value={field.value ?? ""}
              onChange={(event) => field.onChange(event.target.value)}
              disabled={readonly}
              placeholder="告诉模型什么时候该调用这个工具"
              rows={2}
              style={{
                width: "100%",
                resize: "none",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid var(--border-color, #e2e8f0)",
                fontSize: "13px",
                fontFamily: "inherit",
              }}
            />
          </FormItem>
        ) : (
          <FormItem name="工具描述" type="string">
            <ReadonlyValue value={field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function TimeoutInput() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<number> name="timeoutMs" defaultValue={0}>
      {({ field }) =>
        isSidebar ? (
          <FormItem name="超时时间(ms)" type="number">
            <InputNumber
              value={field.value ?? 0}
              disabled={readonly}
              onChange={(value) => field.onChange(value ?? 0)}
              min={0}
              step={1000}
              size="small"
              style={{ width: "100%" }}
              placeholder="0 表示一直等到回传"
            />
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
              超时后从「错误」口往下走。0 表示一直等。
            </div>
          </FormItem>
        ) : (
          <FormItem name="超时时间(ms)" type="number">
            <ReadonlyValue value={!field.value ? "不超时" : `${field.value}ms`} />
          </FormItem>
        )
      }
    </Field>
  );
}

function generateXiaozhiPrompt(nodeData: {
  toolName?: string;
  toolDescription?: string;
  inputSchema?: {
    properties?: Record<string, { type?: string; title?: string; default?: unknown }>;
  };
}): string {
  const toolName = nodeData?.toolName || "[工具名称]";
  const description = nodeData?.toolDescription || "接收用户请求后的回传数据";
  const properties = nodeData?.inputSchema?.properties ?? {};
  const exampleData: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(properties)) {
    if (prop.default !== undefined) exampleData[key] = prop.default;
    else if (prop.type === "string") exampleData[key] = prop.title || key;
    else if (prop.type === "number") exampleData[key] = 0;
    else if (prop.type === "boolean") exampleData[key] = true;
    else if (prop.type === "object") exampleData[key] = {};
  }
  const paramExample = JSON.stringify(
    Object.keys(exampleData).length ? exampleData : { action: "trigger", data: {} },
    null,
    2,
  );

  return `当用户完成相关请求时，必须调用 MCP 工具 "${toolName}"。
工具用途：${description}
调用参数示例：
${paramExample}
只在确认任务完成后调用一次，不要提前或重复调用。`;
}

function WebhookPromptGenerator() {
  const isSidebar = useIsSidebar();
  const { nodeData } = useNodeRenderContext();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const prompt = generateXiaozhiPrompt(nodeData ?? {});

  if (!isSidebar) {
    return (
      <FormItem name="提示词片段" type="string">
        <ReadonlyValue value="打开侧边栏复制给「设置智能体」使用" />
      </FormItem>
    );
  }

  return (
    <FormItem name="提示词片段">
      <div
        style={{
          padding: "12px",
          background: "#f8fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          fontSize: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <div style={{ color: "#64748b", fontWeight: 500 }}>
            把这段加到「设置智能体」的提示词里
          </div>
          <Button
            size="mini"
            icon={showAdvanced ? <EyeOff size={12} /> : <Eye size={12} />}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "收起" : "展开"}
          </Button>
        </div>
        <div
          style={{
            padding: "12px",
            background: "#fff",
            borderRadius: "6px",
            fontFamily: "inherit",
            fontSize: "13px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: showAdvanced ? "400px" : "150px",
            overflow: "auto",
            border: "1px solid #e2e8f0",
            marginBottom: "12px",
          }}
        >
          {prompt}
        </div>
        <Button
          type="warning"
          icon={<Copy size={14} />}
          onClick={() => {
            void navigator.clipboard.writeText(prompt);
          }}
        >
          复制提示词
        </Button>
      </div>
    </FormItem>
  );
}

function InputSchemaEditor() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<Record<string, unknown>> name="inputSchema">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="参数 Schema" type="object">
            <textarea
              className="workflow-form-textarea"
              value={JSON.stringify(field.value ?? {}, null, 2)}
              onChange={(event) => {
                try {
                  field.onChange(JSON.parse(event.target.value) as Record<string, unknown>);
                } catch {
                  // keep last valid schema while typing
                }
              }}
              disabled={readonly}
              placeholder='{"type": "object", "properties": {...}}'
              rows={4}
              style={{
                width: "100%",
                resize: "vertical",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid var(--border-color, #e2e8f0)",
                fontSize: "12px",
                fontFamily: "monospace",
              }}
            />
          </FormItem>
        ) : (
          <FormItem name="参数 Schema" type="object">
            <ReadonlyValue value={JSON.stringify(field.value, null, 2)} />
          </FormItem>
        )
      }
    </Field>
  );
}

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <ToolNameInput />
        <ToolDescriptionInput />
        <TimeoutInput />
        <WebhookPromptGenerator />
        <Divider />
        <InputSchemaEditor />
        <Divider />
        <FormInputs />
        <Divider />
        <Field<JsonSchema> name="outputs">
          {({ field }) => <DisplayOutputs value={field.value} />}
        </Field>
      </FormContent>
    </>
  );
};

export const formMeta: FormMeta<FlowNodeJSON> = {
  ...defaultFormMeta,
  render: renderForm,
  validate: {
    ...defaultFormMeta.validate,
    toolName: ({ value }) => {
      const name = typeof value === "string" ? value.trim() : "";
      if (!name) return "请输入工具名称";
      if (!TOOL_NAME_PATTERN.test(name)) {
        return "工具名必须以字母开头，只能包含字母、数字和下划线";
      }
      return undefined;
    },
  },
};
