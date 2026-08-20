/**
 * 智能体节点表单 - 配置智能体提示词切换
 */

import { Divider, Select } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FieldRenderProps, FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";
import { useXiaozhiAgentsQuery } from "@buildingai/services/web";

import {
  FormContent,
  FormHeader,
  FormItem,
  ReadonlyValue,
} from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { FlowNodeJSON } from "../../typings";
import { defaultFormMeta } from "../default-form-meta";

function AgentActionSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="action" defaultValue="switch_prompt">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="操作类型" required type="string">
            <Select
              value={field.value}
              disabled={readonly}
              onChange={(value) => field.onChange(value as string)}
              size="small"
              style={{ width: "100%" }}
            >
              <Select.Option value="switch_prompt">切换提示词</Select.Option>
              <Select.Option value="enable">启用智能体</Select.Option>
              <Select.Option value="disable">停用智能体</Select.Option>
            </Select>
          </FormItem>
        ) : (
          <FormItem name="操作类型" type="string">
            <ReadonlyValue value={
              field.value === "switch_prompt" ? "切换提示词" :
              field.value === "enable" ? "启用智能体" : "停用智能体"
            } />
          </FormItem>
        )
      }
    </Field>
  );
}

function AgentSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  const { data: agents, isLoading } = useXiaozhiAgentsQuery();

  return (
    <Field<string> name="agentId">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="目标智能体" required type="string">
            <Select
              value={field.value}
              disabled={readonly || isLoading}
              placeholder={isLoading ? "加载中..." : "选择智能体"}
              emptyContent="暂无智能体"
              optionList={agents?.map((item) => ({ label: item.name, value: item.agentId })) ?? []}
              onChange={(value) => field.onChange(value as string)}
              filter
              size="small"
              style={{ width: "100%" }}
            />
          </FormItem>
        ) : (
          <FormItem name="目标智能体" type="string">
            <ReadonlyValue value={agents?.find(a => a.agentId === field.value)?.name ?? field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function PromptEditor() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="prompt">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="提示词内容" required type="string">
            <textarea
              className="workflow-form-textarea"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              disabled={readonly}
              placeholder="输入智能体的新提示词..."
              rows={6}
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
          <FormItem name="提示词内容" type="string">
            <ReadonlyValue value={field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function PromptNameInput() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="promptName">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="提示词名称" type="string">
            <input
              className="workflow-form-input"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              disabled={readonly}
              placeholder="例如：智能语音助手、导航模式..."
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
          <FormItem name="提示词名称" type="string">
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
        <AgentActionSelect />
        <AgentSelect />
        <Divider />
        <PromptNameInput />
        <PromptEditor />
      </FormContent>
    </>
  );
};

export const formMeta: FormMeta<FlowNodeJSON> = {
  ...defaultFormMeta,
  render: renderForm,
  validate: {
    ...defaultFormMeta.validate,
    agentId: ({ value }: { value?: string }) =>
      value ? undefined : "请选择目标智能体",
    prompt: ({ value, formData }: { value?: string; formData?: FlowNodeJSON }) => {
      if (formData?.action === "switch_prompt" && !value) {
        return "切换提示词时必须填写提示词内容";
      }
      return undefined;
    },
  },
};
