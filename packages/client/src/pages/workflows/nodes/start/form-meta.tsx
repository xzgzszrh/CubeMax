/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field, ValidateTrigger } from "@flowgram.ai/free-layout-editor";
import type { FieldRenderProps, FormRenderProps, FormMeta } from "@flowgram.ai/free-layout-editor";
import {
  DisplayOutputs,
  JsonSchemaEditor,
  provideJsonSchemaOutputs,
  syncVariableTitle,
} from "@flowgram.ai/form-materials";

import type { FlowNodeJSON, JsonSchema } from "../../typings";
import { useIsSidebar } from "../../hooks";
import { FormHeader, FormContent } from "../../form-components";

export const renderForm = ({ form }: FormRenderProps<FlowNodeJSON>) => {
  const isSidebar = useIsSidebar();
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
    title: ({ value }: { value: string }) => (value ? undefined : "Title is required"),
  },
  effect: {
    title: syncVariableTitle,
    outputs: provideJsonSchemaOutputs,
  },
};
