/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import styled from "styled-components";

import { IconMinimap } from "../../assets/icon-minimap";

export const ToolsLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
`;

export const ToolSection = styled.div`
  display: flex;
  align-items: center;
  background-color: #fff;
  border: 1px solid rgba(68, 83, 130, 0.25);
  border-radius: 10px;
  box-shadow:
    rgba(0, 0, 0, 0.04) 0px 2px 6px 0px,
    rgba(0, 0, 0, 0.02) 0px 4px 12px 0px;
  column-gap: 2px;
  height: 40px;
  padding: 0 4px;
  pointer-events: auto;
`;

export const LeftToolSection = styled(ToolSection)`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
  width: 50px;
  height: auto;
  padding: 7px;
  row-gap: 5px;
  border-radius: 15px;

  .semi-button,
  .ui-mouse-pad-selector {
    width: 36px !important;
    height: 36px !important;
    min-width: 36px;
    border-radius: 10px !important;
    color: rgba(32, 41, 69, 0.75);
  }

  .semi-button:hover,
  .ui-mouse-pad-selector:hover,
  .ui-mouse-pad-selector-active {
    color: #0064fa;
    background: rgba(0, 100, 250, 0.08);
  }
`;

export const BottomLeftToolSection = styled(ToolSection)`
  position: absolute;
  bottom: 16px;
  left: 16px;
  padding: 4px;
  border-radius: 14px;
`;

export const TopRightToolSection = styled(ToolSection)`
  position: absolute;
  top: 16px;
  right: 68px;
  height: 40px;
  padding: 4px;
  border-radius: 10px;
`;

export const BottomCenterToolSection = styled(ToolSection)`
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px;
  border-radius: 14px;
`;

export const BottomRightToolSection = styled.div`
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
`;

export const ViewportToolSection = styled(ToolSection)`
  padding: 4px;
  border-radius: 14px;
`;

export const SelectZoom = styled.span`
  box-sizing: border-box;
  padding: 4px 8px;
  border-radius: 10px;
  border: 1px solid rgba(68, 83, 130, 0.25);
  font-size: 12px;
  width: 64px;
  line-height: 22px;
  text-align: center;
  background: #fff;
  cursor: pointer;
  pointer-events: auto;
`;

export const MinimapContainer = styled.div`
  height: 118px;
  width: 198px;
  pointer-events: auto;
`;

export const UIIconMinimap = styled(IconMinimap)<{ visible: boolean }>`
  color: ${(props) => (props.visible ? undefined : "#060709cc")};
`;
