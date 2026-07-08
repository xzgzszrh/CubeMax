/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useLayoutEffect } from "react";

import { nanoid } from "nanoid";
import { Field, FieldArray } from "@flowgram.ai/free-layout-editor";
import { ConditionRow } from "@flowgram.ai/form-materials";
import type { ConditionRowValueType } from "@flowgram.ai/form-materials";
import { Button } from "@douyinfe/semi-ui";
import { IconPlus, IconCrossCircleStroked } from "@douyinfe/semi-icons";

import { useIsSidebar, useNodeRenderContext } from "../../../hooks";
import { FormItem } from "../../../form-components";
import { Feedback } from "../../../form-components";
import { ConditionPort } from "./styles";

interface ConditionValue {
  key: string;
  value?: ConditionRowValueType;
}

export function ConditionInputs() {
  const { node, readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  const inputReadonly = readonly || !isSidebar;

  useLayoutEffect(() => {
    window.requestAnimationFrame(() => {
      node.ports.updateDynamicPorts();
    });
  }, [node]);

  return (
    <FieldArray name="conditions">
      {({ field }) => (
        <>
          {field.map((child, index) => (
            <Field<ConditionValue> key={child.name} name={child.name}>
              {({ field: childField, fieldState: childState }) => (
                <FormItem name="如果" type="boolean" required={true} labelWidth={50}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <ConditionRow
                      readonly={inputReadonly}
                      style={{ flexGrow: 1, overflow: "hidden" }}
                      value={childField.value.value}
                      onChange={(v) => {
                        if (inputReadonly) {
                          return;
                        }
                        childField.onChange({ value: v, key: childField.value.key });
                      }}
                    />

                    {isSidebar && !readonly && (
                      <Button
                        theme="borderless"
                        disabled={readonly}
                        icon={<IconCrossCircleStroked />}
                        onClick={() => field.delete(index)}
                      />
                    )}
                  </div>

                  <Feedback errors={childState?.errors} invalid={childState?.invalid} />
                  <ConditionPort data-port-id={childField.value.key} data-port-type="output" />
                </FormItem>
              )}
            </Field>
          ))}
          <FormItem name="否则" type="boolean" required={true} labelWidth={100}>
            <ConditionPort data-port-id="else" data-port-type="output" />
          </FormItem>
          {isSidebar && !readonly && (
            <div>
              <Button
                theme="borderless"
                icon={<IconPlus />}
                onClick={() =>
                  field.append({
                    key: `if_${nanoid(6)}`,
                    value: { type: "expression", content: "" },
                  })
                }
              >
                添加条件
              </Button>
            </div>
          )}
        </>
      )}
    </FieldArray>
  );
}
