/**
 * 等待节点表单 - 配置等待条件
 */

import { Divider, InputNumber, Select } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";

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

const WAIT_TYPE_OPTIONS = [
  { value: "timeout", label: "超时等待" },
  { value: "mcp_call", label: "等待 MCP 调用" },
  { value: "webhook", label: "等待 Webhook 触发" },
  { value: "variable", label: "等待变量变化（尚未接入）", disabled: true },
];

function WaitTypeSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="waitType" defaultValue="timeout">
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
                <Select.Option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        ) : (
          <FormItem name="等待类型" type="string">
            <ReadonlyValue
              value={
                WAIT_TYPE_OPTIONS.find((item) => item.value === field.value)?.label ??
                field.value ??
                "未设置"
              }
            />
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
    <Field<string> name="waitType">
      {({ field: typeField }) => {
        if (typeField.value === "timeout") return null;
        const label = typeField.value === "webhook" ? "Webhook 标识" : "工具名称";
        const placeholder =
          typeField.value === "webhook"
            ? "例如 timer_complete，HTTP 回传时带上这个标识"
            : "CubeCat 调用的 MCP 工具名，例如 timer_complete";
        return (
          <Field<string> name="triggerId">
            {({ field }) =>
              isSidebar ? (
                <FormItem name={label} required type="string">
                  <input
                    className="workflow-form-input"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    disabled={readonly}
                    placeholder={placeholder}
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
                <FormItem name={label} type="string">
                  <ReadonlyValue value={field.value ?? "未设置"} />
                </FormItem>
              )
            }
          </Field>
        );
      }}
    </Field>
  );
}

function TimeoutInput() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="waitType">
      {({ field: typeField }) => (
        <Field<number> name="timeoutMs" defaultValue={typeField.value === "timeout" ? 5000 : 0}>
          {({ field }) =>
            isSidebar ? (
              <FormItem
                name={typeField.value === "timeout" ? "等待时长(ms)" : "超时时间(ms)"}
                required={typeField.value === "timeout"}
                type="number"
              >
                <InputNumber
                  value={field.value ?? 0}
                  disabled={readonly}
                  onChange={(value) => field.onChange(value ?? 0)}
                  min={0}
                  step={1000}
                  size="small"
                  style={{ width: "100%" }}
                  placeholder={typeField.value === "timeout" ? "例如 5000" : "0 表示一直等到事件"}
                />
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                  {typeField.value === "timeout"
                    ? "到点后从「继续」口往下走。"
                    : "0 表示不超时。超时后从「超时」口往下走。"}
                </div>
              </FormItem>
            ) : (
              <FormItem name="超时时间(ms)" type="number">
                <ReadonlyValue
                  value={
                    !field.value
                      ? typeField.value === "timeout"
                        ? "未设置"
                        : "不超时"
                      : `${field.value}ms`
                  }
                />
              </FormItem>
            )
          }
        </Field>
      )}
    </Field>
  );
}

function ExpectedDataConfig() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="waitType">
      {({ field: typeField }) => {
        if (typeField.value === "timeout") return null;
        return (
          <>
            <Field<string> name="expectedDataPath">
              {({ field }) =>
                isSidebar ? (
                  <FormItem name="期望数据路径" type="string">
                    <input
                      className="workflow-form-input"
                      value={field.value ?? ""}
                      onChange={(event) => field.onChange(event.target.value)}
                      disabled={readonly}
                      placeholder="例如: data.result 或 action"
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
                      onChange={(event) => field.onChange(event.target.value)}
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
      }}
    </Field>
  );
}

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <WaitTypeSelect />
        <TriggerIdInput />
        <TimeoutInput />
        <ExpectedDataConfig />
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
    triggerId: ({ value, formValues }) => {
      const waitType = formValues.waitType as string | undefined;
      if ((waitType === "mcp_call" || waitType === "webhook") && !String(value ?? "").trim()) {
        return waitType === "webhook" ? "请填写 Webhook 标识" : "请填写要等待的 MCP 工具名";
      }
      return undefined;
    },
    timeoutMs: ({ value, formValues }) => {
      if (formValues.waitType === "timeout" && !(Number(value) > 0)) {
        return "请设置大于 0 的等待时长";
      }
      return undefined;
    },
  },
};
