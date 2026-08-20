/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import {
  DisplayOutputs,
  JsonSchemaEditor,
  provideJsonSchemaOutputs,
  syncVariableTitle,
} from "@flowgram.ai/form-materials";
import type { FieldRenderProps, FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field, ValidateTrigger } from "@flowgram.ai/free-layout-editor";

import { useOptionalProgrammingProject } from "../../../programming/context";
import { FormContent, FormHeader } from "../../form-components";
import { useIsSidebar } from "../../hooks";
import type { FlowNodeJSON, JsonSchema } from "../../typings";

export const renderForm = () => {
  const isSidebar = useIsSidebar();
  const project = useOptionalProgrammingProject();
  if (isSidebar && project?.projectType === "application") {
    return (
      <>
        <FormHeader />
        <FormContent>
          <div className="workflow-application-start-hint">
            应用从这个节点开始运行，不需要填写对话输入。把设备、Lua 或智能动作连接到这里即可。
          </div>
        </FormContent>
      </>
    );
  }
  if (isSidebar) {
    return (
      <>
        <FormHeader />
        <FormContent>
          <Field
            name="outputs"
            render={({ field: { value, onChange } }: FieldRenderProps<JsonSchema>) => (
              <>
                <JsonSchemaEditor
                  value={value}
                  onChange={(value) => onChange(value as JsonSchema)}
                />
              </>
            )}
          />
        </FormContent>
      </>
    );
  }
  return (
    <>
      <FormHeader />
      <FormContent>
        <DisplayOutputs displayFromScope />
      </FormContent>
    </>
  );
};

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: {
    title: ({ value }: { value: string }) => (value ? undefined : "标题为必填项"),
  },
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
  },
};
