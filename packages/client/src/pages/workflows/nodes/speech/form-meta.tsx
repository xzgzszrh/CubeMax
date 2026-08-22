/**
 * 语音播报节点表单 - 配置语音播报参数
 */

import { Divider, Select, Slider, Switch } from "@douyinfe/semi-ui";
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

const VOICE_OPTIONS = [
  { value: "Cherry", label: "芊悦 Cherry" },
  { value: "Serena", label: "苏瑶 Serena" },
  { value: "Ethan", label: "晨煦 Ethan" },
  { value: "Chelsie", label: "千雪 Chelsie" },
  { value: "Bella", label: "萌宝 Bella" },
  { value: "Neil", label: "阿闻 Neil" },
];

function VoiceSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="voice" defaultValue="Cherry">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="音色" type="string">
            <Select
              value={field.value || "Cherry"}
              disabled={readonly}
              onChange={(value) => field.onChange(value as string)}
              size="small"
              style={{ width: "100%" }}
            >
              {VOICE_OPTIONS.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        ) : (
          <FormItem name="音色" type="string">
            <ReadonlyValue
              value={VOICE_OPTIONS.find((item) => item.value === field.value)?.label ?? "芊悦 Cherry"}
            />
          </FormItem>
        )
      }
    </Field>
  );
}

function VolumeControl() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<number> name="volume" defaultValue={1}>
      {({ field }) =>
        isSidebar ? (
          <FormItem name="音量" type="number">
            <Slider
              value={field.value ?? 1}
              disabled={readonly}
              onChange={(value) => field.onChange(value as number)}
              min={0}
              max={1}
              step={0.1}
              style={{ width: "100%" }}
            />
          </FormItem>
        ) : (
          <FormItem name="音量" type="number">
            <ReadonlyValue value={`${Math.round((field.value ?? 1) * 100)}%`} />
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
        <SpeechTextEditor />
        <Divider />
        <VoiceSelect />
        <VolumeControl />
        <Divider />
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
};
