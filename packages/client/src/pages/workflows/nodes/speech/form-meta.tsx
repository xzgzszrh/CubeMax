/**
 * 语音播报节点表单 - 配置语音播报参数
 */

import { Divider, InputNumber, Select, Slider, Switch } from "@douyinfe/semi-ui";
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

function AgentSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="agentId">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="目标设备" required type="string">
            <input
              className="workflow-form-input"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              disabled={readonly}
              placeholder="输入智能体 ID"
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
          <FormItem name="目标设备" type="string">
            <ReadonlyValue value={field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function SpeechModeSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="mode" defaultValue="speak">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="播报模式" type="string">
            <Select
              value={field.value}
              disabled={readonly}
              onChange={(value) => field.onChange(value as string)}
              size="small"
              style={{ width: "100%" }}
            >
              <Select.Option value="speak">立即播报</Select.Option>
              <Select.Option value="queue">排队播报</Select.Option>
            </Select>
          </FormItem>
        ) : (
          <FormItem name="播报模式" type="string">
            <ReadonlyValue value={field.value === "speak" ? "立即播报" : "排队播报"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function SpeechTextEditor() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="text">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="播报内容" required type="string">
            <textarea
              className="workflow-form-textarea"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              disabled={readonly}
              placeholder="输入要播报的文字内容..."
              rows={4}
              style={{
                width: "100%",
                resize: "vertical",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid var(--border-color, #e2e8f0)",
                fontSize: "13px",
                fontFamily: "inherit",
              }}
            />
          </FormItem>
        ) : (
          <FormItem name="播报内容" type="string">
            <ReadonlyValue value={field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function SpeedControl() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<number> name="speed" defaultValue={1.0}>
      {({ field }) =>
        isSidebar ? (
          <FormItem name="语速" type="number">
            <Slider
              value={field.value ?? 1.0}
              disabled={readonly}
              onChange={(value) => field.onChange(value as number)}
              min={0.5}
              max={2.0}
              step={0.1}
              style={{ width: "100%" }}
            />
            <div style={{ textAlign: "center", fontSize: "12px", color: "#64748b" }}>
              {(field.value ?? 1.0).toFixed(1)}x
            </div>
          </FormItem>
        ) : (
          <FormItem name="语速" type="number">
            <ReadonlyValue value={`${(field.value ?? 1.0).toFixed(1)}x`} />
          </FormItem>
        )
      }
    </Field>
  );
}

function WaitForCompleteSwitch() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<boolean> name="waitForComplete" defaultValue={true}>
      {({ field }) =>
        isSidebar ? (
          <FormItem name="等待播报完成" type="boolean">
            <Switch
              checked={field.value ?? true}
              disabled={readonly}
              onChange={(checked) => field.onChange(checked)}
              size="small"
            />
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
              开启后，工作流会等待语音播报完成后再继续
            </div>
          </FormItem>
        ) : (
          <FormItem name="等待播报完成" type="boolean">
            <ReadonlyValue value={field.value ? "是" : "否"} />
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
        <AgentSelect />
        <SpeechModeSelect />
        <Divider />
        <SpeechTextEditor />
        <Divider />
        <SpeedControl />
        <WaitForCompleteSwitch />
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
    text: ({ value }: { value?: string }) =>
      value?.trim() ? undefined : "请输入播报内容",
  },
};
