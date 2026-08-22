/**
 * 视觉节点表单 - 配置 iPhone 拍摄目标
 */

import { useMobileInstallationsQuery } from "@buildingai/services/web";
import { Divider, Select } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";

import { FormContent, FormHeader, FormItem, ReadonlyValue } from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { FlowNodeJSON } from "../../typings";
import { defaultFormMeta } from "../default-form-meta";

const BINDING_OPTIONS = [
  { value: "triggering_device", label: "从这台 CubeMax 启动时使用本机" },
  { value: "specific", label: "指定一台已登录的手机" },
];

function BindingSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  return (
    <Field<string> name="deviceBinding">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="拍摄目标" required type="string">
            <Select
              value={field.value || "triggering_device"}
              disabled={readonly}
              onChange={(value) => field.onChange(value as string)}
              size="small"
              style={{ width: "100%" }}
            >
              {BINDING_OPTIONS.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        ) : (
          <FormItem name="拍摄目标" type="string">
            <ReadonlyValue
              value={
                BINDING_OPTIONS.find((item) => item.value === field.value)?.label ??
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

function InstallationSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  const { data, isLoading } = useMobileInstallationsQuery();
  const items = data?.items ?? [];
  return (
    <Field<string> name="deviceBinding">
      {({ field: binding }) =>
        binding.value !== "specific" ? null : (
          <Field<string> name="installationId">
            {({ field }) =>
              isSidebar ? (
                <FormItem name="拍摄设备" required type="string">
                  <Select
                    value={field.value}
                    disabled={readonly || isLoading}
                    placeholder={isLoading ? "加载中..." : "选择已登录的 CubeMax"}
                    emptyContent="暂无在线或已登记的手机，请先用 CubeMax 登录"
                    optionList={items.map((item) => ({
                      label: `${item.device_model || "iPhone"} · ${item.installation_id.slice(0, 8)}${item.online ? "（在线）" : ""}`,
                      value: item.installation_id,
                    }))}
                    onChange={(value) => field.onChange(value as string)}
                    size="small"
                    style={{ width: "100%" }}
                  />
                </FormItem>
              ) : (
                <FormItem name="拍摄设备" type="string">
                  <ReadonlyValue value={field.value || "未指定"} />
                </FormItem>
              )
            }
          </Field>
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

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <FormItem name="拍摄方式" type="string">
          <ReadonlyValue value="CubeMax iPhone 拍摄一张照片并回传" />
        </FormItem>
        <BindingSelect />
        <InstallationSelect />
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
