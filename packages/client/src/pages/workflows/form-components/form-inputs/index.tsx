/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { IFlowValue } from "@flowgram.ai/form-materials";
import { Field } from "@flowgram.ai/free-layout-editor";
import type { ReactNode } from "react";

import { SafePromptEditorWithVariables } from "../../components/safe-editor-with-variables";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { JsonSchema } from "../../typings";
import { Feedback } from "../feedback";
import { FormItem } from "../form-item";
import { ReadonlyValue } from "../readonly-value";
import { FlowValueInput } from "./flow-value-input";
import { LLMModelReadonlyValue, LLMModelSelect } from "./model-select";

export { FlowAssignRows } from "./flow-assign-rows";
export { FlowInputsValues } from "./flow-inputs-values";
export {
  FlowValueInput,
  type FlowValueInputProps,
  type FlowValueInputUi,
} from "./flow-value-input";

export interface FormInputRendererProps {
  inputName: string;
  schema: JsonSchema;
  value?: IFlowValue;
  onChange: (value?: IFlowValue) => void;
  readonly: boolean;
  hasError: boolean;
}

interface FormInputsProps {
  renderInput?: (props: FormInputRendererProps) => ReactNode | undefined;
}

export function FormInputs({ renderInput }: FormInputsProps = {}) {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<JsonSchema> name="inputs">
      {({ field: inputsField }) => {
        const required = inputsField.value?.required || [];
        const properties = inputsField.value?.properties;
        if (!properties) {
          return <></>;
        }
        const content = Object.keys(properties).map((key) => {
          const property = properties[key];

          const formComponent = property.extra?.formComponent;

          const vertical = ["prompt-editor"].includes(formComponent || "");
          const label = typeof property.title === "string" ? property.title : key;
          const description =
            typeof property.description === "string" ? property.description : undefined;

          return (
            <Field key={key} name={`inputsValues.${key}`} defaultValue={property.default}>
              {({ field, fieldState }) => {
                const hasError = Object.keys(fieldState?.errors || {}).length > 0;
                const customInput = renderInput?.({
                  inputName: key,
                  schema: property,
                  value: field.value,
                  onChange: field.onChange,
                  readonly,
                  hasError,
                });

                return (
                  <FormItem
                    name={label}
                    description={description}
                    vertical={vertical}
                    type={property.type as string}
                    required={required.includes(key)}
                  >
                    {!isSidebar ? (
                      formComponent === "llm-model-select" ? (
                        <LLMModelReadonlyValue value={field.value} />
                      ) : (
                        <ReadonlyValue value={field.value} multiline={vertical} />
                      )
                    ) : (
                      <>
                        {formComponent === "prompt-editor" && (
                          <SafePromptEditorWithVariables
                            value={field.value}
                            onChange={field.onChange}
                            readonly={readonly}
                            hasError={hasError}
                          />
                        )}
                        {formComponent === "llm-model-select" && (
                          <LLMModelSelect value={field.value} onChange={field.onChange} />
                        )}
                        {!formComponent &&
                          (customInput ?? (
                            <FlowValueInput
                              value={field.value}
                              onChange={field.onChange}
                              readonly={readonly}
                              hasError={hasError}
                              schema={property}
                            />
                          ))}
                      </>
                    )}
                    <Feedback errors={fieldState?.errors} warnings={fieldState?.warnings} />
                  </FormItem>
                );
              }}
            </Field>
          );
        });
        return <>{content}</>;
      }}
    </Field>
  );
}
