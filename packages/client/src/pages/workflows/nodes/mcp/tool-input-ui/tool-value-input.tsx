import { IconButton, Select, Tooltip } from "@douyinfe/semi-ui";
import { InjectVariableSelector } from "@flowgram.ai/form-materials";
import type { IFlowValue } from "@flowgram.ai/form-materials";
import { PencilLine, Variable } from "lucide-react";
import { useEffect, useRef } from "react";

import type { JsonSchema } from "../../../typings";
import type { McpToolInputUi } from "./registry";

import styles from "./tool-value-input.module.less";

interface McpToolValueInputProps {
  inputUi: McpToolInputUi;
  value?: IFlowValue;
  onChange: (value?: IFlowValue) => void;
  schema: JsonSchema;
  readonly?: boolean;
  hasError?: boolean;
}

function createFallbackConstantValue(schema: JsonSchema, inputUi: McpToolInputUi): IFlowValue {
  const schemaDefault = schema.default;
  if (
    schemaDefault &&
    typeof schemaDefault === "object" &&
    "type" in schemaDefault &&
    schemaDefault.type === "constant"
  ) {
    return schemaDefault as IFlowValue;
  }

  const content =
    inputUi.control === "boolean"
      ? false
      : inputUi.showClear
        ? ""
        : (inputUi.options[0]?.value ?? "");

  return { type: "constant", content, schema };
}

export function McpToolValueInput({
  inputUi,
  value,
  onChange,
  schema,
  readonly = false,
  hasError = false,
}: McpToolValueInputProps) {
  const isVariableMode = value?.type === "ref";
  const lastConstantValueRef = useRef<IFlowValue>(
    value && value.type !== "ref" ? value : createFallbackConstantValue(schema, inputUi),
  );

  useEffect(() => {
    if (value && value.type !== "ref") {
      lastConstantValueRef.current = value;
    }
  }, [value]);

  const setConstantContent = (content: string | number | boolean) => {
    const nextFlowValue: IFlowValue = { type: "constant", content, schema };
    lastConstantValueRef.current = nextFlowValue;
    onChange(nextFlowValue);
  };

  const switchToVariable = () => {
    if (readonly || isVariableMode) return;
    onChange({ type: "ref", content: [] });
  };

  const switchToConstant = () => {
    if (readonly || !isVariableMode) return;
    onChange(lastConstantValueRef.current);
  };

  const renderConstantInput = () => {
    if (inputUi.control === "boolean") {
      const selectedValue = typeof value?.content === "boolean" ? value.content : undefined;

      return (
        <div className={styles["boolean-options"]} role="group" aria-label="布尔值">
          {[
            { label: inputUi.trueLabel ?? "True", value: true },
            { label: inputUi.falseLabel ?? "False", value: false },
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

    const selectedValue =
      (typeof value?.content === "string" && value.content !== "") ||
      typeof value?.content === "number"
        ? value.content
        : undefined;

    return (
      <Select
        value={selectedValue}
        onChange={(nextValue) =>
          setConstantContent(
            typeof nextValue === "string" || typeof nextValue === "number" ? nextValue : "",
          )
        }
        disabled={readonly}
        emptyContent="暂无可用选项"
        optionList={inputUi.options}
        placeholder={inputUi.placeholder}
        showClear={inputUi.showClear}
        size="small"
        style={{ width: "100%" }}
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
        className={`${styles["value-control"]} ${inputUi.control === "boolean" ? styles["boolean-value-control"] : ""} ${hasError ? styles.error : ""}`}
      >
        {isVariableMode ? (
          <InjectVariableSelector
            value={Array.isArray(value?.content) ? value.content : undefined}
            onChange={(path) => onChange({ type: "ref", content: path ?? [] })}
            includeSchema={schema}
            readonly={readonly}
            config={{ placeholder: "设置变量值", notFoundContent: "变量不可用" }}
            hasError={hasError}
            style={{ width: "100%" }}
          />
        ) : (
          renderConstantInput()
        )}
      </div>
    </div>
  );
}
