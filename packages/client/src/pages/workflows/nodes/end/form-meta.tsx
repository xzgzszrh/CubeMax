/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { IFlowValue } from "@flowgram.ai/form-materials";
import { createInferInputsPlugin, DisplayInputsValues } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";

import { FlowInputsValues, FormContent, FormHeader } from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import { defaultFormMeta } from "../default-form-meta";

export const renderForm = () => {
  const isSidebar = useIsSidebar();
  const { readonly } = useNodeRenderContext();
  if (isSidebar) {
    return (
      <>
        <FormHeader />
        <FormContent>
          <Field<Record<string, IFlowValue | undefined> | undefined> name="inputsValues">
            {({ field: { value, onChange } }) => (
              <>
                <FlowInputsValues
                  value={value}
                  onChange={(_v) => onChange(_v)}
                  readonly={readonly}
                  addLabel="添加输出"
                  keyPlaceholder="输出名称"
                />
              </>
            )}
          </Field>
        </FormContent>
      </>
    );
  }
  return (
    <>
      <FormHeader />
      <FormContent>
        <Field<Record<string, IFlowValue | undefined> | undefined> name="inputsValues">
          {({ field: { value } }) => (
            <>
              <DisplayInputsValues value={value} />
            </>
          )}
        </Field>
      </FormContent>
    </>
  );
};

export const formMeta: FormMeta = {
  ...defaultFormMeta,
  render: renderForm,
  plugins: [
    createInferInputsPlugin({
      sourceKey: "inputsValues",
      targetKey: "inputs",
    }),
  ],
};
