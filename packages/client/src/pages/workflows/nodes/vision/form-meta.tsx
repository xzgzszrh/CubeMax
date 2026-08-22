/**
 * 视觉节点表单 - 配置摄像头和 AI 分析
 */

import { Divider } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";

import { FormContent, FormHeader, FormItem, ReadonlyValue } from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { FlowNodeJSON } from "../../typings";
import { defaultFormMeta } from "../default-form-meta";

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

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <FormItem name="拍摄方式" type="string">
          <ReadonlyValue value="CubeCat 摄像头单张拍照并分析" />
        </FormItem>
        <Divider />
        <AnalysisPromptEditor />
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
