/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Divider, InputNumber, Switch } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";

import { FormContent, FormHeader, FormInputs, FormItem, ReadonlyValue } from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import { defaultFormMeta } from "../default-form-meta";

function EmbeddedOptions() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <>
      <FormItem name="超时(ms)" required type="number">
        <Field<number> name="timeoutMs" defaultValue={60000}>
          {({ field }) =>
            isSidebar ? (
              <InputNumber
                disabled={readonly}
                min={1000}
                onChange={(value) => field.onChange(value as number)}
                size="small"
                style={{ width: "100%" }}
                value={field.value}
              />
            ) : (
              <ReadonlyValue value={field.value} />
            )
          }
        </Field>
      </FormItem>

      <FormItem name="出错时失败" required type="boolean">
        <Field<boolean> name="failOnToolError" defaultValue>
          {({ field }) =>
            isSidebar ? (
              <Switch
                checked={field.value}
                disabled={readonly}
                onChange={(checked) => field.onChange(checked)}
                size="small"
              />
            ) : (
              <ReadonlyValue value={field.value} />
            )
          }
        </Field>
      </FormItem>
    </>
  );
}

export const renderForm = () => (
  <>
    <FormHeader />
    <FormContent>
      <FormInputs />
      <Divider />
      <EmbeddedOptions />
      <Divider />
      <DisplayOutputs displayFromScope />
    </FormContent>
  </>
);

export const formMeta: FormMeta = {
  ...defaultFormMeta,
  render: renderForm,
  validate: {
    ...defaultFormMeta.validate,
    embeddedAction: ({ value }: { value?: string }) =>
      value ? undefined : "嵌入式动作为必填项",
  },
};
