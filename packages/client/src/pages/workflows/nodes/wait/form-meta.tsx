/**
 * 等待节点表单 - 配置等待条件
 */

import { Divider, InputNumber, Select, Switch } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FieldRenderProps, FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";

import {
  FormContent,
  FormHeader,
  FormItem,
  ReadonlyValue,
} from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { FlowNodeJSON } from "../../typings";
import { defaultFormMeta } from "../default-form-meta";

const WAIT_TYPE_OPTIONS = [
  { value: "mcp_call", label: "等待 MCP 调用" },
  { value: "webhook", label: "等待 Webhook 触发" },
  { value: "timeout", label: "超时等待" },
  { value: "variable", label: "等待变量变化" },
];

const WAIT_TYPE_DESCRIPTIONS: Record<string, string> = {
  mcp_call: "等待 xiaozhi.me 的智能体调用 MCP 回传数据",
  webhook: "等待外部系统通过 Webhook 触发",
  timeout: "等待指定时间后自动继续",
  variable: "等待全局变量满足条件后继续",
};

function WaitTypeSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="waitType" defaultValue="mcp_call">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="等待类型" required type="string">
            <Select
              value={field.value}
              disabled={readonly}
              onChange={(value) => field.onChange(value as string)}
              size="small"
              style={{ width: "100%" }}
            >
              {WAIT_TYPE_OPTIONS.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        ) : (
          <FormItem name="等待类型" type="string">
            <ReadonlyValue value={
              WAIT_TYPE_OPTIONS.find(o => o.value === field.value)?.label ?? field.value ?? "未设置"
            } />
          </FormItem>
        )
      }
    </Field>
  );
}

function TriggerIdInput() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="triggerId">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="触发器 ID" type="string">
            <input
              className="workflow-form-input"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              disabled={readonly}
              placeholder="输入 MCP 节点 ID 或 Webhook 标识"
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color, #e2e8f0)",
                fontSize: "13px",
              }}
            />
          </FormItem>
        ) : (
          <FormItem name="触发器 ID" type="string">
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
              placeholder="0 表示不超时"
            />
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
              设置为 0 则不超时，等待条件满足
            </div>
          </FormItem>
        ) : (
          <FormItem name="超时时间(ms)" type="number">
            <ReadonlyValue value={field.value === 0 ? "不超时" : `${field.value}ms`} />
          </FormItem>
        )
      }
    </Field>
  );
}

function ExpectedDataConfig() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <>
      <Field<string> name="expectedDataPath">
        {({ field }) =>
          isSidebar ? (
            <FormItem name="期望数据路径" type="string">
              <input
                className="workflow-form-input"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                disabled={readonly}
                placeholder="例如: data.result 或 data.action"
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color, #e2e8f0)",
                  fontSize: "13px",
                }}
              />
            </FormItem>
          ) : (
            <FormItem name="期望数据路径" type="string">
              <ReadonlyValue value={field.value ?? "未设置"} />
            </FormItem>
          )
        }
      </Field>

      <Field<string> name="expectedValue">
        {({ field }) =>
          isSidebar ? (
            <FormItem name="期望值" type="string">
              <input
                className="workflow-form-input"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value)}
                disabled={readonly}
                placeholder="期望的具体值（可选）"
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color, #e2e8f0)",
                  fontSize: "13px",
                }}
              />
            </FormItem>
          ) : (
            <FormItem name="期望值" type="string">
              <ReadonlyValue value={field.value || "任意值"} />
            </FormItem>
          )
        }
      </Field>
    </>
  );
}

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <WaitTypeSelect />
        <TriggerIdInput />
        <Divider />
        <TimeoutInput />
        <ExpectedDataConfig />
        <Divider />
        <Field<any> name="outputs">
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
    triggerId: ({ value, formData }: { value?: string; formData?: FlowNodeJSON }) => {
      const waitType = formData?.waitType;
      if ((waitType === "mcp_call" || waitType === "webhook") && !value) {
        return "MCP 调用或 Webhook 触发需要指定触发器 ID";
      }
      return undefined;
    },
  },
};
