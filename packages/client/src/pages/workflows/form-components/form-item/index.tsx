/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import "./index.css";

import { Tooltip, Typography } from "@douyinfe/semi-ui";
import { DisplaySchemaTag } from "@flowgram.ai/form-materials";
import React, { useCallback } from "react";

import { useOptionalProgrammingProject } from "../../../programming/context";
import { useIsSidebar } from "../../hooks";

const { Text } = Typography;

interface FormItemProps {
  children: React.ReactNode;
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  labelWidth?: number;
  labelStyle?: React.CSSProperties;
  vertical?: boolean;
  style?: React.CSSProperties;
}
export function FormItem({
  children,
  name,
  required,
  description,
  type,
  labelWidth,
  labelStyle,
  vertical,
  style,
}: FormItemProps): JSX.Element {
  const isSidebar = useIsSidebar();
  const project = useOptionalProgrammingProject();
  const renderTitle = useCallback(
    (showTooltip?: boolean) => (
      <div style={{ width: "0", display: "flex", flex: "1" }}>
        <Text style={{ width: "100%" }} ellipsis={{ showTooltip: !!showTooltip }}>
          {name}
          {required && <span style={{ color: "#f93920", paddingLeft: "2px" }}>*</span>}
        </Text>
      </div>
    ),
    [],
  );
  return (
    <div
      style={{
        fontSize: "var(--workflow-form-item-font-size, 12px)",
        marginBottom: "var(--workflow-form-item-margin, 6px)",
        width: "100%",
        position: "relative",
        display: "flex",
        gap: "var(--workflow-form-item-gap, 8px)",
        ...(vertical
          ? { flexDirection: "column" }
          : {
              justifyContent: "center",
              alignItems: "center",
            }),
        ...style,
      }}
    >
      <div
        style={{
          justifyContent: "center",
          alignItems: "center",
          color: "var(--semi-color-text-0)",
          width: labelWidth || "var(--workflow-form-label-width, 118px)",
          minWidth: labelWidth || "var(--workflow-form-label-width, 118px)",
          maxWidth: labelWidth || "var(--workflow-form-label-width, 118px)",
          position: "relative",
          display: "flex",
          columnGap: 4,
          flexShrink: 0,
          ...labelStyle,
        }}
      >
        {type && <DisplaySchemaTag value={{ type }} />}
        {description ? <Tooltip content={description}>{renderTitle()}</Tooltip> : renderTitle(true)}
      </div>

      <div
        style={{
          flexGrow: 1,
          minWidth: 0,
        }}
      >
        {children}
        {isSidebar && project?.projectType === "application" && description && (
          <div className="workflow-form-item-hint">{description}</div>
        )}
      </div>
    </div>
  );
}
