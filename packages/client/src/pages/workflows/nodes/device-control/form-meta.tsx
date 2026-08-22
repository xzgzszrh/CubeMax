/**
 * 设备控制节点表单 - 配置设备控制参数
 */

import { Divider, InputNumber, Select, Switch } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
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

const ACTION_OPTIONS = [
  { value: "led_toggle", label: "背光开关" },
  { value: "buzzer", label: "屏幕通知" },
  { value: "motor", label: "震动马达" },
];

function ActionSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="action" defaultValue="led_toggle">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="控制动作" required type="string">
            <Select
              value={field.value}
              disabled={readonly}
              onChange={(value) => field.onChange(value as string)}
              size="small"
              style={{ width: "100%" }}
            >
              {ACTION_OPTIONS.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        ) : (
          <FormItem name="控制动作" type="string">
            <ReadonlyValue value={ACTION_OPTIONS.find(o => o.value === field.value)?.label ?? field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function LedParams() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<boolean> name="ledState" defaultValue={true}>
      {({ field }) =>
        isSidebar ? (
          <FormItem name="背光状态" type="boolean">
            <Switch
              checked={field.value ?? true}
              disabled={readonly}
              onChange={(checked) => field.onChange(checked)}
              size="small"
              checkedText="亮"
              uncheckedText="灭"
            />
          </FormItem>
        ) : (
          <FormItem name="背光状态" type="boolean">
            <ReadonlyValue value={field.value ? "亮" : "灭"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function BuzzerParams() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="notifyText">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="通知内容" type="string">
            <input
              className="workflow-form-input"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              disabled={readonly}
              placeholder="显示在 CubeCat 上的短通知"
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
          <FormItem name="通知内容" type="string">
            <ReadonlyValue value={field.value || "beep"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function MotorParams() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <>
      <Field<number> name="buzzerDurationMs" defaultValue={400}>
        {({ field }) =>
          isSidebar ? (
            <FormItem name="震动时长(ms)" type="number">
              <InputNumber
                value={field.value ?? 400}
                disabled={readonly}
                onChange={(value) => field.onChange(value ?? 400)}
                min={50}
                max={5000}
                step={50}
                size="small"
                style={{ width: "100%" }}
              />
            </FormItem>
          ) : (
            <FormItem name="震动时长(ms)" type="number">
              <ReadonlyValue value={`${field.value ?? 400} ms`} />
            </FormItem>
          )
        }
      </Field>

      <Field<string> name="motorDirection" defaultValue="forward">
        {({ field }) =>
          isSidebar ? (
            <FormItem name="方向" type="string">
              <Select
                value={field.value ?? "forward"}
                disabled={readonly}
                onChange={(value) => field.onChange(value as string)}
                size="small"
                style={{ width: "100%" }}
              >
                <Select.Option value="forward">正转</Select.Option>
                <Select.Option value="reverse">反转</Select.Option>
                <Select.Option value="stop">停止</Select.Option>
              </Select>
            </FormItem>
          ) : (
            <FormItem name="方向" type="string">
              <ReadonlyValue value={
                field.value === "forward" ? "正转" :
                field.value === "reverse" ? "反转" : "停止"
              } />
            </FormItem>
          )
        }
      </Field>
    </>
  );
}

function DynamicParams() {
  const { nodeData } = useNodeRenderContext();
  const action = nodeData?.action as string;

  switch (action) {
    case "led_toggle":
    case "led_rgb":
      return <LedParams />;
    case "buzzer":
      return <BuzzerParams />;
    case "motor":
      return <MotorParams />;
    default:
      return null;
  }
}

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <ActionSelect />
        <Divider />
        <DynamicParams />
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
};
