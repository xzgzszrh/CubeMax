/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { IFlowValue } from "@flowgram.ai/form-materials";
import { DisplayInputsValues } from "@flowgram.ai/form-materials";
import { Field } from "@flowgram.ai/free-layout-editor";

import { FlowInputsValues, FormItem } from "../../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../../hooks";

export function Params() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  if (!isSidebar) {
    return (
      <FormItem name="查询参数" type="object" vertical>
        <Field<Record<string, IFlowValue | undefined> | undefined> name="paramsValues">
          {({ field }) => <DisplayInputsValues value={field.value} />}
        </Field>
      </FormItem>
    );
  }

  return (
    <FormItem name="查询参数" type="object" vertical>
      <Field<Record<string, IFlowValue | undefined> | undefined> name="paramsValues">
        {({ field }) => (
          <FlowInputsValues
            value={field.value}
            onChange={(value) => field.onChange(value)}
            schema={{ type: "string" }}
            readonly={readonly}
            addLabel="添加查询参数"
            keyPlaceholder="参数名称"
          />
        )}
      </Field>
    </FormItem>
  );
}
