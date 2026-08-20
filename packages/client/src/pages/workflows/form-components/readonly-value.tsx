/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { CSSProperties } from "react";

const DEFAULT_PLACEHOLDER = "未设置";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringifyContent(value: unknown, placeholder: string): string {
  if (value === undefined || value === null || value === "") {
    return placeholder;
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatReadonlyValue(
  value: unknown,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  if (!isRecord(value) || typeof value.type !== "string") {
    return stringifyContent(value, placeholder);
  }

  if (value.type === "ref") {
    if (Array.isArray(value.content)) {
      return value.content.length > 0 ? `{{${value.content.join(".")}}}` : placeholder;
    }
    return value.content ? `{{${String(value.content)}}}` : placeholder;
  }

  if ("content" in value) {
    return stringifyContent(value.content, placeholder);
  }

  return stringifyContent(value, placeholder);
}

export function ReadonlyValue(props: {
  value?: unknown;
  placeholder?: string;
  multiline?: boolean;
  style?: CSSProperties;
}) {
  const { value, placeholder = DEFAULT_PLACEHOLDER, multiline = false, style } = props;
  const text = formatReadonlyValue(value, placeholder);
  const isPlaceholder = text === placeholder;

  return (
    <div
      title={text}
      style={{
        alignItems: multiline ? "flex-start" : "center",
        background: "rgba(28, 31, 35, 0.06)",
        borderRadius: 6,
        boxSizing: "border-box",
        color: isPlaceholder ? "rgba(28, 31, 35, 0.45)" : "rgba(28, 31, 35, 0.88)",
        display: "flex",
        fontSize: "var(--workflow-readonly-font-size, 12px)",
        lineHeight: "var(--workflow-readonly-line-height, 20px)",
        minHeight: "var(--workflow-readonly-height, 32px)",
        overflow: "hidden",
        padding: "var(--workflow-readonly-padding, 6px 10px)",
        textOverflow: "ellipsis",
        whiteSpace: multiline ? "pre-wrap" : "nowrap",
        width: "100%",
        wordBreak: multiline ? "break-word" : "normal",
        ...style,
      }}
    >
      {text}
    </div>
  );
}
