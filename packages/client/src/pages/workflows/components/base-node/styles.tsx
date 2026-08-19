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
  border-radius: 12px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 22px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  width: 360px;
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
`;

export const ErrorIcon = () => (
  <IconInfoCircle
    style={{
      position: "absolute",
      color: "#dc2626",
      left: 10,
      top: 10,
      zIndex: 1,
      background: "#fff",
      borderRadius: 999,
      fontSize: 16,
    }}
  />
);
