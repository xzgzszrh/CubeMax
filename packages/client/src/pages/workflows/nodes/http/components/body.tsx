/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Select } from "@douyinfe/semi-ui";
import type { IFlowTemplateValue } from "@flowgram.ai/form-materials";
import { Field } from "@flowgram.ai/free-layout-editor";

import {
  SafeJsonEditorWithVariables,
  SafePromptEditorWithVariables,
} from "../../../components/safe-editor-with-variables";
import { FormItem } from "../../../form-components";
import { useNodeRenderContext } from "../../../hooks";

const BODY_TYPE_OPTIONS = [
  {
    label: "None",
    value: "none",
  },
  {
    label: "JSON",
    value: "JSON",
  },
  {
    label: "Raw Text",
    value: "raw-text",
  },
];

export function Body() {
  const { readonly } = useNodeRenderContext();

  const renderBodyEditor = (bodyType: string) => {
    switch (bodyType) {
      case "JSON":
        return (
          <Field<IFlowTemplateValue> name="body.json">
            {({ field }) => (
              <SafeJsonEditorWithVariables
                value={field.value?.content}
                readonly={readonly}
                activeLinePlaceholder="use var by '@'"
                onChange={(value) => {
                  field.onChange({ type: "template", content: value });
                }}
              />
            )}
          </Field>
        );
      case "raw-text":
        return (
          <Field<IFlowTemplateValue> name="body.rawText">
            {({ field }) => (
              <SafePromptEditorWithVariables
                disableMarkdownHighlight
                readonly={readonly}
                style={{ flexGrow: 1 }}
                placeholder="Input raw text, use var by '{'"
                onChange={(value) => {
                  field.onChange(value!);
                }}
              />
            )}
          </Field>
        );
      default:
        return null;
    }
  };

  return (
    <Field<string> name="body.bodyType" defaultValue="JSON">
      {({ field }) => (
        <div style={{ marginTop: 5 }}>
          <FormItem name="Body" vertical type="object">
            <Select
              value={field.value}
              onChange={(value) => {
                field.onChange(value as string);
              }}
              style={{ width: "100%", marginBottom: 10 }}
              disabled={readonly}
              size="small"
              optionList={BODY_TYPE_OPTIONS}
            />
            {renderBodyEditor(field.value)}
          </FormItem>
        </div>
      )}
    </Field>
  );
}
