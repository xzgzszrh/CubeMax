/**
 * 视觉节点表单 - 配置摄像头和 AI 分析
 */

import { Divider, Select, Switch } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";

import { FormContent, FormHeader, FormItem, ReadonlyValue } from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { FlowNodeJSON } from "../../typings";
import { defaultFormMeta } from "../default-form-meta";

const CAPTURE_MODE_OPTIONS = [
  { value: "photo", label: "单张拍照" },
  { value: "continuous", label: "连续拍摄" },
  { value: "stream", label: "视频流" },
];

function CaptureModeSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="captureMode" defaultValue="photo">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="拍摄模式" required type="string">
            <Select
              value={field.value}
              disabled={readonly}
              onChange={(value) => field.onChange(value as string)}
              size="small"
              style={{ width: "100%" }}
            >
              {CAPTURE_MODE_OPTIONS.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        ) : (
          <FormItem name="拍摄模式" type="string">
            <ReadonlyValue
              value={
                CAPTURE_MODE_OPTIONS.find((o) => o.value === field.value)?.label ??
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

function ModelSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="modelId">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="分析模型" type="string">
            <Select
              value={field.value || undefined}
              disabled={readonly}
              placeholder="暂未接入视觉模型，将使用默认模型"
              emptyContent="暂无可用视觉模型"
              optionList={[]}
              onChange={(value) => field.onChange((value as string) ?? "")}
              showClear
              size="small"
              style={{ width: "100%" }}
            />
          </FormItem>
        ) : (
          <FormItem name="分析模型" type="string">
            <ReadonlyValue value={field.value || "默认模型"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function AnalysisPromptEditor() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="analysisPrompt">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="分析提示词" type="string">
            <textarea
              className="workflow-form-textarea"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              disabled={readonly}
              placeholder="输入你希望 AI 分析图片的内容，例如：识别图片中的人物数量和动作"
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
          <FormItem name="分析提示词" type="string">
            <ReadonlyValue value={field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function SaveImageSwitch() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<boolean> name="saveImage" defaultValue={false}>
      {({ field }) =>
        isSidebar ? (
          <FormItem name="保存图片" type="boolean">
            <Switch
              checked={field.value}
              disabled={readonly}
              onChange={(checked) => field.onChange(checked)}
              size="small"
            />
          </FormItem>
        ) : (
          <FormItem name="保存图片" type="boolean">
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
        <CaptureModeSelect />
        <Divider />
        <ModelSelect />
        <AnalysisPromptEditor />
        <Divider />
        <SaveImageSwitch />
        <Divider />
        <Field<any> name="outputs">{({ field }) => <DisplayOutputs value={field.value} />}</Field>
      </FormContent>
    </>
  );
};

export const formMeta: FormMeta<FlowNodeJSON> = {
  ...defaultFormMeta,
  render: renderForm,
};
