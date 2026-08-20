/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from "styled-components";

export const FormWrapper = styled.div`
  box-sizing: border-box;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--workflow-form-gap, 8px);
  background-color: #ffffff;
  padding: var(--workflow-form-padding, 10px 12px 12px);
`;

export const FormTitleDescription = styled.div`
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
  background: #f8fafc;
  border: 1px solid #edf0f5;
  border-radius: 8px;
  padding: 8px 10px;
  word-break: break-all;
  white-space: break-spaces;
`;

export const GuideCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 11px 12px;
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 10px;
  background: linear-gradient(145deg, #f8fbff 0%, #f3f7ff 100%);
`;

export const GuideHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
`;

export const GuideIcon = styled.span`
  display: inline-flex;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: #dbeafe;
  color: #2563eb;
`;

export const GuideLabel = styled.div`
  color: #1d4ed8;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 14px;
`;

export const GuideText = styled.div`
  margin-top: 2px;
  color: #334155;
  font-size: 12px;
  line-height: 17px;
`;

export const GuideList = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    position: relative;
    display: grid;
    grid-template-columns: 19px 1fr;
    align-items: center;
    column-gap: 7px;
    color: #475569;
    font-size: 11px;
    line-height: 16px;
  }

  li > span {
    display: inline-flex;
    width: 19px;
    height: 19px;
    align-items: center;
    justify-content: center;
    border: 1px solid #bfdbfe;
    border-radius: 999px;
    background: #ffffff;
    color: #2563eb;
    font-size: 10px;
    font-weight: 700;
  }

  li > svg {
    position: absolute;
    top: 19px;
    left: 4px;
    color: #93c5fd;
  }
`;

export const GuideResult = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding-top: 7px;
  border-top: 1px solid rgba(147, 197, 253, 0.4);
  color: #475569;
  font-size: 11px;
  line-height: 16px;

  > svg {
    flex: 0 0 auto;
    margin-top: 1px;
    color: #2563eb;
  }

  > div {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  strong {
    color: #1e3a8a;
    font-size: 10px;
  }
`;

export const GuideExample = styled.div`
  padding: 6px 8px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.72);
  color: #64748b;
  font-size: 10px;
  line-height: 15px;
`;
