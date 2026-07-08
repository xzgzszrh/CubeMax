/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Field } from "@flowgram.ai/free-layout-editor";
import { InputNumber } from "@douyinfe/semi-ui";

import { useIsSidebar, useNodeRenderContext } from "../../../hooks";
import { FormItem, ReadonlyValue } from "../../../form-components";

export function Timeout() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <div>
      <FormItem name="超时(ms)" required style={{ flex: 1 }} type="number">
        <Field<number> name="timeout.timeout" defaultValue={10000}>
          {({ field }) =>
            isSidebar ? (
              <InputNumber
                size="small"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value as number);
                }}
                disabled={readonly}
                style={{ width: "100%" }}
                min={0}
              />
            ) : (
              <ReadonlyValue value={field.value} />
            )
          }
        </Field>
      </FormItem>
      <FormItem name="重试次数" required type="number">
        <Field<number> name="timeout.retryTimes" defaultValue={1}>
          {({ field }) =>
            isSidebar ? (
              <InputNumber
                size="small"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value as number);
                }}
                disabled={readonly}
                style={{ width: "100%" }}
                min={0}
              />
            ) : (
              <ReadonlyValue value={field.value} />
            )
          }
        </Field>
      </FormItem>
    </div>
  );
}
