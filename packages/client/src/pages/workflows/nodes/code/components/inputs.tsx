/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { IFlowValue } from "@flowgram.ai/form-materials";
import { DisplayInputsValues } from "@flowgram.ai/form-materials";
import { Field } from "@flowgram.ai/free-layout-editor";

import { FlowInputsValues, FormItem } from "../../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../../hooks";

export function Inputs() {
  const isSidebar = useIsSidebar();

  const { readonly } = useNodeRenderContext();

  if (!isSidebar) {
    return (
      <Field<Record<string, IFlowValue | undefined> | undefined> name="inputsValues">
        {({ field }) => <DisplayInputsValues value={field.value} />}
      </Field>
    );
  }

  return (
    <FormItem name="输入" type="object" vertical>
      <Field<Record<string, IFlowValue | undefined> | undefined> name="inputsValues">
        {({ field }) => (
          <FlowInputsValues
            value={field.value}
            onChange={(value) => field.onChange(value)}
            readonly={readonly}
            addLabel="添加代码输入"
            keyPlaceholder="输入名称"
          />
        )}
      </Field>
    </FormItem>
  );
}
