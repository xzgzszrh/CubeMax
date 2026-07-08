/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { MinimapRender } from "@flowgram.ai/minimap-plugin";

import { MinimapContainer } from "./styles";

export const Minimap = ({ visible = true }: { visible?: boolean }) => {
  if (!visible) {
    return <></>;
  }
  return (
    <MinimapContainer>
      <MinimapRender
        panelStyles={{}}
        containerStyles={{
          height: "100%",
          pointerEvents: "auto",
          position: "relative",
          top: "unset",
          right: "unset",
          bottom: "unset",
          left: "unset",
          width: "100%",
        }}
        inactiveStyle={{
          opacity: 1,
          scale: 1,
          translateX: 0,
          translateY: 0,
        }}
      />
    </MinimapContainer>
  );
};
