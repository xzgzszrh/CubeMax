/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import "./index.less";

import type { ProgrammingProjectType } from "@buildingai/services/web";
import { Popover } from "@douyinfe/semi-ui";
import type { WorkflowPortEntity } from "@flowgram.ai/free-layout-editor";
import { useClientContext } from "@flowgram.ai/free-layout-editor";
import type { NodePanelRenderProps as NodePanelRenderPropsDefault } from "@flowgram.ai/free-node-panel-plugin";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { ConversationNodeList, NodeList } from "./node-list";
import { NodePlaceholder } from "./node-placeholder";

interface NodePanelRenderProps extends NodePanelRenderPropsDefault {
  projectType?: ProgrammingProjectType;
  panelProps?: {
    fromPort?: WorkflowPortEntity;
    enableNodePlaceholder?: boolean;
  };
}

/**
 * FlowGram mounts the node panel inside its zoomable layer. The palette itself
 * is intentionally rendered as a canvas-level drawer so it remains stable
 * while the user pans or zooms the workflow.
 */
export const NodePanel: React.FC<NodePanelRenderProps> = (props) => {
  const {
    onSelect,
    onClose,
    containerNode,
    panelProps = {},
    enableMultiAdd,
    position,
    projectType = "conversation",
  } = props;
  const { fromPort } = panelProps;
  const { playground } = useClientContext();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (projectType !== "application") {
    const { enableNodePlaceholder } = panelProps;
    return (
      <Popover
        trigger="click"
        visible
        onVisibleChange={(visible) => (visible ? null : onClose())}
        content={
          <ConversationNodeList
            onSelect={onSelect}
            containerNode={containerNode}
            fromPort={fromPort}
          />
        }
        getPopupContainer={containerNode ? () => panelRef.current || document.body : undefined}
        placement="right"
        popupAlign={{ offset: [30, 0] }}
        overlayStyle={{ padding: 0 }}
      >
        <div
          ref={panelRef}
          style={
            enableNodePlaceholder
              ? {
                  position: "absolute",
                  top: position.y - 61.5,
                  left: position.x,
                  width: 360,
                  height: 100,
                }
              : {
                  position: "absolute",
                  top: position.y,
                  left: position.x,
                  width: 0,
                  height: 0,
                }
          }
        >
          {enableNodePlaceholder && <NodePlaceholder />}
        </div>
      </Popover>
    );
  }

  const content = (
    <div className="workflow-node-library-portal">
      <button
        type="button"
        className="workflow-node-library-backdrop"
        aria-label="关闭节点库"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="workflow-node-library-drawer"
        data-has-connection-context={String(Boolean(fromPort))}
      >
        <button
          type="button"
          className="workflow-node-library-close"
          onClick={onClose}
          aria-label="关闭节点库"
          title="关闭节点库"
        >
          <X size={17} />
        </button>
        <NodeList
          onSelect={onSelect}
          containerNode={containerNode}
          fromPort={fromPort}
          enableMultiAdd={enableMultiAdd}
          projectType={projectType}
        />
      </aside>
    </div>
  );

  const portalHost = playground.node?.parentElement ?? playground.node;
  return portalHost ? createPortal(content, portalHost) : content;
};
