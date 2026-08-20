/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from "styled-components";

export const Header = styled.div`
  box-sizing: border-box;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  column-gap: var(--workflow-header-gap, 8px);
  min-height: var(--workflow-header-height, 52px);
  border-bottom: 1px solid #edf0f5;
  cursor: move;

  background: #f8fafc;
  overflow: hidden;

  padding: var(--workflow-header-padding, 9px 12px);

  .semi-button {
    color: #64748b;
    border-radius: 7px;
  }

  .semi-button:hover {
    color: #1d4ed8;
    background: #e8efff;
  }
`;

export const Title = styled.div`
  font-size: var(--workflow-header-title-size, 14px);
  font-weight: 600;
  line-height: var(--workflow-header-title-line-height, 20px);
  flex: 1;
  width: 0;
  color: #172033;
`;

export const HeaderMeta = styled.span`
  color: #94a3b8;
  font-size: var(--workflow-header-meta-size, 10px);
  font-weight: 500;
  line-height: 14px;
  white-space: nowrap;
`;

export const Icon = styled.img`
  width: var(--workflow-header-icon-size, 28px);
  height: var(--workflow-header-icon-size, 28px);
  object-fit: cover;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: var(--workflow-header-icon-radius, 8px);
  flex: 0 0 auto;
`;

export const Operators = styled.div`
  display: flex;
  align-items: center;
  column-gap: 4px;
`;
