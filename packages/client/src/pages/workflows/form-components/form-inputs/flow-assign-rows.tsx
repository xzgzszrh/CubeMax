/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconDelete, IconPlus } from "@douyinfe/semi-icons";
import { Button, IconButton, Input } from "@douyinfe/semi-ui";
import { type AssignValueType, type IFlowValue } from "@flowgram.ai/form-materials";
import { FieldArray } from "@flowgram.ai/free-layout-editor";

import styles from "./flow-assign-rows.module.less";
import { FlowValueInput } from "./flow-value-input";
import { FlowVariableSelector } from "./flow-variable-selector";

interface FlowAssignRowsProps {
  name: string;
  readonly?: boolean;
  defaultValue?: AssignValueType[];
}

export function FlowAssignRows({ name, readonly = false, defaultValue }: FlowAssignRowsProps) {
  return (
    <FieldArray<AssignValueType | undefined> name={name} defaultValue={defaultValue}>
      {({ field }) => (
        <div className={styles.container}>
          <div className={styles.rows}>
            {field.map((childField, index) => {
              const rowValue = childField.value ?? { operator: "assign" as const };
              return (
                <div className={styles.row} key={childField.key}>
                  <div className={styles["row-header"]}>
                    {rowValue.operator === "assign" ? (
                      <FlowVariableSelector
                        style={{ width: "100%" }}
                        value={rowValue.left?.content}
                        config={{ placeholder: "选择要赋值的变量", notFoundContent: "变量不可用" }}
                        readonly={readonly}
                        onChange={(path) =>
                          childField.onChange({
                            ...rowValue,
                            left: { type: "ref", content: path ?? [] },
                          })
                        }
                      />
                    ) : (
                      <Input
                        disabled={readonly}
                        size="small"
                        placeholder="输入变量名称"
                        value={rowValue.left}
                        onChange={(variableName) =>
                          childField.onChange({ ...rowValue, left: variableName })
                        }
                      />
                    )}
                    <IconButton
                      className={styles["delete-button"]}
                      disabled={readonly}
                      theme="borderless"
                      icon={<IconDelete size="small" />}
                      size="small"
                      onClick={() => field.remove(index)}
                      aria-label="删除变量操作"
                    />
                  </div>
                  <FlowValueInput
                    value={rowValue.right}
                    onChange={(right: IFlowValue | undefined) =>
                      childField.onChange({ ...rowValue, right })
                    }
                    readonly={readonly}
                  />
                </div>
              );
            })}
          </div>
          <div className={styles.actions}>
            <Button
              disabled={readonly}
              size="small"
              theme="borderless"
              icon={<IconPlus />}
              onClick={() => field.append({ operator: "assign" })}
            >
              赋值变量
            </Button>
            <Button
              disabled={readonly}
              size="small"
              theme="borderless"
              icon={<IconPlus />}
              onClick={() => field.append({ operator: "declare" })}
            >
              声明变量
            </Button>
          </div>
        </div>
      )}
    </FieldArray>
  );
}
