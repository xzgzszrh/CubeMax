/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { FlowNodeEntity } from "@flowgram.ai/free-layout-editor";
import { useNodeRender } from "@flowgram.ai/free-layout-editor";

import { NodeRenderContext } from "../../context";

export function SidebarNodeRenderer(props: { node: FlowNodeEntity }) {
  const { node } = props;
  const nodeRender = useNodeRender(node);

  return (
    <NodeRenderContext.Provider value={nodeRender}>
      <div
        style={{
          background: "#ffffff",
          height: "100%",
          width: "100%",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxSizing: "border-box",
          overflow: "auto",
        }}
      >
        {nodeRender.form?.render()}
      </div>
    </NodeRenderContext.Provider>
  );
}
