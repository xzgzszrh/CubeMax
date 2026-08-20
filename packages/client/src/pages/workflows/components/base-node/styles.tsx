/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconInfoCircle } from "@douyinfe/semi-icons";
import styled from "styled-components";

export const NodeWrapperStyle = styled.div`
  align-items: flex-start;
  background: #ffffff;
  border: 1px solid #dfe4ec;
  border-radius: var(--workflow-node-radius, 12px);
  box-sizing: border-box;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 22px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  width: var(--workflow-node-width, 360px);
  min-width: 0;
  height: auto;
  overflow: hidden;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;

  &:hover {
    border-color: #c4ccd9;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.05),
      0 10px 26px rgba(15, 23, 42, 0.08);
  }

  &.selected {
    border-color: #2563eb;
    box-shadow:
      0 0 0 3px rgba(37, 99, 235, 0.12),
      0 10px 26px rgba(15, 23, 42, 0.09);
  }

  &:focus-visible {
    outline: 3px solid rgba(37, 99, 235, 0.2);
    outline-offset: 2px;
  }

  /* Keep the canvas view readable while reducing the vertical rhythm of
   * Semi controls. The editable sidebar is rendered outside this wrapper. */
  .semi-input-wrapper,
  .semi-input-number,
  .semi-select,
  .semi-tree-select {
    min-height: var(--workflow-control-height, 32px);
    height: var(--workflow-control-height, 32px);
  }

  .semi-input,
  .semi-input-number-input,
  .semi-select-selection,
  .semi-tree-select-selection {
    font-size: var(--workflow-control-font-size, 12px);
  }
`;

export const ErrorIcon = () => (
  <IconInfoCircle
    style={{
      position: "absolute",
      color: "#dc2626",
      left: 8,
      top: 8,
      zIndex: 1,
      background: "#fff",
      borderRadius: 999,
      fontSize: 16,
    }}
  />
);
