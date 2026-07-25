/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconDelete, IconPlus } from "@douyinfe/semi-icons";
import { Button, IconButton, Input } from "@douyinfe/semi-ui";
import type { IFlowValue } from "@flowgram.ai/form-materials";
import { useObjectList } from "@flowgram.ai/form-materials";

import type { JsonSchema } from "../../typings";
import styles from "./flow-inputs-values.module.less";
import { FlowValueInput } from "./flow-value-input";

interface FlowInputsValuesProps {
  value?: Record<string, IFlowValue | undefined>;
  onChange: (value?: Record<string, IFlowValue | undefined>) => void;
  schema?: JsonSchema;
  readonly?: boolean;
  hasError?: boolean;
  addLabel?: string;
  keyPlaceholder?: string;
}

export function FlowInputsValues({
  value,
  onChange,
  schema,
  readonly = false,
  hasError = false,
  addLabel = "添加输入",
  keyPlaceholder = "输入名称",
}: FlowInputsValuesProps) {
  const { list, updateKey, updateValue, remove, add } = useObjectList<IFlowValue | undefined>({
    value,
    onChange,
    sortIndexKey: "extra.index",
  });

  return (
    <div className={styles.container}>
      <div className={styles.rows}>
        {list.map((item) => (
          <div className={styles.row} key={item.id}>
            <div className={styles["row-header"]}>
              <Input
                disabled={readonly}
                size="small"
                value={item.key}
                onChange={(nextKey) => updateKey(item.id, nextKey)}
                placeholder={keyPlaceholder}
                className={styles["key-input"]}
              />
              <TooltipDeleteButton disabled={readonly} onClick={() => remove(item.id)} />
            </div>
            <FlowValueInput
              value={item.value}
              onChange={(nextValue) => updateValue(item.id, nextValue)}
              schema={schema}
              readonly={readonly}
              hasError={hasError}
            />
          </div>
        ))}
      </div>
      <Button
        className={styles["add-button"]}
        disabled={readonly}
        icon={<IconPlus />}
        size="small"
        theme="borderless"
        onClick={() => add(createDefaultValue(schema))}
      >
        {addLabel}
      </Button>
    </div>
  );
}

function createDefaultValue(schema?: JsonSchema): IFlowValue {
  const resolvedSchema = schema ?? { type: "string" };
  return {
    type: "constant",
    content: resolvedSchema.type === "boolean" ? false : "",
    schema: resolvedSchema,
  };
}

function TooltipDeleteButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <IconButton
      className={styles["delete-button"]}
      disabled={disabled}
      theme="borderless"
      icon={<IconDelete size="small" />}
      size="small"
      onClick={onClick}
      aria-label="删除输入"
    />
  );
}
