/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconButton, Select, Tooltip } from "@douyinfe/semi-ui";
import type { IFlowValue } from "@flowgram.ai/form-materials";
import { ConstantInput, TypeSelector, useTypeManager } from "@flowgram.ai/form-materials";
import { PencilLine, Variable } from "lucide-react";
import { useEffect, useRef } from "react";

import type { JsonSchema } from "../../typings";
import styles from "./flow-value-input.module.less";
import { FlowVariableSelector } from "./flow-variable-selector";

export interface FlowValueSelectOption {
  label: string;
  value: string | number;
}

export interface FlowValueSelectUi {
  control: "select";
  options: FlowValueSelectOption[];
  placeholder?: string;
  showClear?: boolean;
}

export interface FlowValueBooleanUi {
  control: "boolean";
  trueLabel?: string;
  falseLabel?: string;
}

export type FlowValueInputUi = FlowValueSelectUi | FlowValueBooleanUi;

export interface FlowValueInputProps {
  value?: IFlowValue;
  onChange: (value?: IFlowValue) => void;
  schema?: JsonSchema;
  inputUi?: FlowValueInputUi;
  readonly?: boolean;
  hasError?: boolean;
}

function getDefaultContent(schema: JsonSchema, inputUi?: FlowValueInputUi): unknown {
  const schemaDefault = schema.default;
  if (
    schemaDefault &&
    typeof schemaDefault === "object" &&
    "type" in schemaDefault &&
    schemaDefault.type === "constant"
  ) {
    return (schemaDefault as IFlowValue).content;
  }
  if (schemaDefault !== undefined) return schemaDefault;

  if (inputUi?.control === "select" && !inputUi.showClear) {
    return inputUi.options[0]?.value ?? "";
  }

  switch (schema.type) {
    case "boolean":
      return false;
    case "integer":
    case "number":
      return 0;
    case "object":
    case "map":
      return "{}";
    case "array":
      return "[]";
    default:
      return "";
  }
}

function createConstantValue(schema: JsonSchema, inputUi?: FlowValueInputUi): IFlowValue {
  return {
    type: "constant",
    content: getDefaultContent(schema, inputUi),
    schema,
  };
}

function resolveSchemaInputUi(schema: JsonSchema): FlowValueInputUi | undefined {
  if (schema.type === "boolean") {
    return { control: "boolean", trueLabel: "是", falseLabel: "否" };
  }

  const values = schema.enum?.filter(
    (value): value is string | number => typeof value === "string" || typeof value === "number",
  );
  if (!values?.length) return undefined;

  const enumLabels = schema.extra?.enumLabels as Record<string, string> | undefined;
  return {
    control: "select",
    options: values.map((value) => ({
      label: enumLabels?.[String(value)] ?? String(value),
      value,
    })),
    placeholder: "请选择",
    showClear: true,
  };
}

export function FlowValueInput({
  value,
  onChange,
  schema,
  inputUi,
  readonly = false,
  hasError = false,
}: FlowValueInputProps) {
  const typeManager = useTypeManager();
  const isVariableMode = value?.type === "ref";
  const initialSchema = schema ??
    (value?.type === "constant" ? value.schema : undefined) ?? {
      type: "string",
    };
  const lastConstantValueRef = useRef<IFlowValue>(
    value && value.type !== "ref" ? value : createConstantValue(initialSchema, inputUi),
  );

  useEffect(() => {
    if (value && value.type !== "ref") {
      lastConstantValueRef.current = value;
    }
  }, [value]);

  const constantValue = value && value.type !== "ref" ? value : lastConstantValueRef.current;
  const constantSchema = schema ??
    (constantValue.type === "constant" ? constantValue.schema : undefined) ?? { type: "string" };
  const resolvedInputUi = inputUi ?? resolveSchemaInputUi(constantSchema);

  const setConstantContent = (content: unknown) => {
    const nextFlowValue: IFlowValue = {
      type: "constant",
      content,
      schema: constantSchema,
      extra: value?.extra,
    };
    lastConstantValueRef.current = nextFlowValue;
    onChange(nextFlowValue);
  };

  const switchToVariable = () => {
    if (readonly || isVariableMode) return;
    onChange({ type: "ref", content: [], extra: value?.extra });
  };

  const switchToConstant = () => {
    if (readonly || !isVariableMode) return;
    onChange(lastConstantValueRef.current);
  };

  const changeConstantSchema = (nextSchema?: Partial<JsonSchema>) => {
    const normalizedSchema = (nextSchema ?? { type: "string" }) as JsonSchema;
    let content = typeManager.getDefaultValue(normalizedSchema);
    if (normalizedSchema.type === "object" || normalizedSchema.type === "map") content = "{}";
    if (normalizedSchema.type === "array") content = "[]";

    const nextFlowValue: IFlowValue = {
      type: "constant",
      content,
      schema: normalizedSchema,
      extra: value?.extra,
    };
    lastConstantValueRef.current = nextFlowValue;
    onChange(nextFlowValue);
  };

  const renderConstantInput = () => {
    if (resolvedInputUi?.control === "boolean") {
      const selectedValue =
        typeof constantValue.content === "boolean" ? constantValue.content : undefined;

      return (
        <div className={styles["boolean-options"]} role="group" aria-label="布尔值">
          {[
            { label: resolvedInputUi.trueLabel ?? "是", value: true },
            { label: resolvedInputUi.falseLabel ?? "否", value: false },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={`${styles["boolean-option"]} ${selectedValue === option.value ? styles.selected : ""}`}
              onClick={() => setConstantContent(option.value)}
              disabled={readonly}
              aria-pressed={selectedValue === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      );
    }

    if (resolvedInputUi?.control === "select") {
      const selectedValue =
        typeof constantValue.content === "string" || typeof constantValue.content === "number"
          ? constantValue.content
          : undefined;

      return (
        <Select
          value={selectedValue}
          onChange={(nextValue) => setConstantContent(nextValue ?? "")}
          disabled={readonly}
          emptyContent="暂无可用选项"
          optionList={resolvedInputUi.options}
          placeholder={resolvedInputUi.placeholder}
          showClear={resolvedInputUi.showClear}
          size="small"
          style={{ width: "100%" }}
        />
      );
    }

    return (
      <ConstantInput
        value={constantValue.content}
        onChange={setConstantContent}
        schema={constantSchema}
        readonly={readonly}
      />
    );
  };

  return (
    <div className={styles["value-input"]} data-mode={isVariableMode ? "variable" : "constant"}>
      <div className={styles["mode-switch"]} role="group" aria-label="参数值类型">
        <Tooltip content="使用变量值">
          <IconButton
            className={`${styles["mode-button"]} ${isVariableMode ? styles.active : ""}`}
            type="tertiary"
            theme="borderless"
            icon={<Variable aria-hidden="true" />}
            onClick={switchToVariable}
            disabled={readonly}
            aria-label="使用变量值"
            aria-pressed={isVariableMode}
          />
        </Tooltip>
        <Tooltip content="使用固定值">
          <IconButton
            className={`${styles["mode-button"]} ${!isVariableMode ? styles.active : ""}`}
            type="tertiary"
            theme="borderless"
            icon={<PencilLine aria-hidden="true" />}
            onClick={switchToConstant}
            disabled={readonly}
            aria-label="使用固定值"
            aria-pressed={!isVariableMode}
          />
        </Tooltip>
      </div>

      <div
        className={`${styles["value-control"]} ${resolvedInputUi?.control === "boolean" && !isVariableMode ? styles["boolean-value-control"] : ""} ${hasError ? styles.error : ""}`}
      >
        {isVariableMode ? (
          <FlowVariableSelector
            value={Array.isArray(value?.content) ? value.content : undefined}
            onChange={(path) => onChange({ type: "ref", content: path ?? [], extra: value?.extra })}
            includeSchema={schema}
            readonly={readonly}
            config={{ placeholder: "设置变量值", notFoundContent: "变量不可用" }}
            hasError={hasError}
            style={{ width: "100%" }}
          />
        ) : (
          <div className={styles["constant-control"]}>
            {!schema && (
              <div className={styles["type-selector"]}>
                <TypeSelector
                  value={constantSchema}
                  onChange={changeConstantSchema}
                  readonly={readonly}
                />
              </div>
            )}
            <div className={styles["constant-input"]}>{renderConstantInput()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
