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
  { value: "led_toggle", label: "LED 开关" },
  { value: "led_rgb", label: "RGB LED" },
  { value: "buzzer", label: "蜂鸣器" },
  { value: "motor", label: "电机" },
  { value: "servo", label: "舵机" },
  { value: "gpio_write", label: "GPIO 写入" },
  { value: "pwm", label: "PWM 输出" },
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
    <>
      <Field<number> name="ledIndex" defaultValue={0}>
        {({ field }) =>
          isSidebar ? (
            <FormItem name="LED 编号" type="number">
              <InputNumber
                value={field.value ?? 0}
                disabled={readonly}
                onChange={(value) => field.onChange(value ?? 0)}
                min={0}
                max={10}
                size="small"
                style={{ width: "100%" }}
              />
            </FormItem>
          ) : (
            <FormItem name="LED 编号" type="number">
              <ReadonlyValue value={field.value ?? 0} />
            </FormItem>
          )
        }
      </Field>

      <Field<boolean> name="ledState" defaultValue={true}>
        {({ field }) =>
          isSidebar ? (
            <FormItem name="LED 状态" type="boolean">
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
            <FormItem name="LED 状态" type="boolean">
              <ReadonlyValue value={field.value ? "亮" : "灭"} />
            </FormItem>
          )
        }
      </Field>
    </>
  );
}

function BuzzerParams() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <>
      <Field<number> name="buzzerFrequency" defaultValue={1000}>
        {({ field }) =>
          isSidebar ? (
            <FormItem name="频率(Hz)" type="number">
              <InputNumber
                value={field.value ?? 1000}
                disabled={readonly}
                onChange={(value) => field.onChange(value ?? 1000)}
                min={20}
                max={20000}
                step={100}
                size="small"
                style={{ width: "100%" }}
              />
            </FormItem>
          ) : (
            <FormItem name="频率(Hz)" type="number">
              <ReadonlyValue value={`${field.value ?? 1000} Hz`} />
            </FormItem>
          )
        }
      </Field>

      <Field<number> name="buzzerDurationMs" defaultValue={500}>
        {({ field }) =>
          isSidebar ? (
            <FormItem name="持续时间(ms)" type="number">
              <InputNumber
                value={field.value ?? 500}
                disabled={readonly}
                onChange={(value) => field.onChange(value ?? 500)}
                min={50}
                max={10000}
                step={50}
                size="small"
                style={{ width: "100%" }}
              />
            </FormItem>
          ) : (
            <FormItem name="持续时间(ms)" type="number">
              <ReadonlyValue value={`${field.value ?? 500} ms`} />
            </FormItem>
          )
        }
      </Field>
    </>
  );
}

function MotorParams() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <>
      <Field<number> name="motorIndex" defaultValue={0}>
        {({ field }) =>
          isSidebar ? (
            <FormItem name="电机编号" type="number">
              <InputNumber
                value={field.value ?? 0}
                disabled={readonly}
                onChange={(value) => field.onChange(value ?? 0)}
                min={0}
                max={4}
                size="small"
                style={{ width: "100%" }}
              />
            </FormItem>
          ) : (
            <FormItem name="电机编号" type="number">
              <ReadonlyValue value={field.value ?? 0} />
            </FormItem>
          )
        }
      </Field>

      <Field<number> name="motorSpeed" defaultValue={100}>
        {({ field }) =>
          isSidebar ? (
            <FormItem name="速度 (%)" type="number">
              <InputNumber
                value={field.value ?? 100}
                disabled={readonly}
                onChange={(value) => field.onChange(value ?? 100)}
                min={0}
                max={100}
                size="small"
                style={{ width: "100%" }}
              />
            </FormItem>
          ) : (
            <FormItem name="速度 (%)" type="number">
              <ReadonlyValue value={`${field.value ?? 100}%`} />
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
