/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconClose, IconSmallTriangleDown, IconSmallTriangleLeft } from "@douyinfe/semi-icons";
import { Button } from "@douyinfe/semi-ui";
import { CommandService, useClientContext } from "@flowgram.ai/free-layout-editor";
import { useEffect, useState } from "react";

import { NodeMenu } from "../../components/node-menu";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import { useNodeFormPanel } from "../../plugins/panel-manager-plugin/hooks";
import { FlowCommandId } from "../../shortcuts";
import type { FlowNodeRegistry } from "../../typings";
import { toggleLoopExpanded } from "../../utils";
import { Header, HeaderMeta, Operators } from "./styles";
import { TitleInput } from "./title-input";
import { getIcon } from "./utils";

export function FormHeader() {
  const { node, expanded, toggleExpand, readonly } = useNodeRenderContext();
  const [titleEdit, updateTitleEdit] = useState<boolean>(false);
  const ctx = useClientContext();
  const isSidebar = useIsSidebar();
  const registry = node.getNodeRegistry<FlowNodeRegistry>();
  const handleExpand = (e: React.MouseEvent) => {
    toggleExpand();
    e.stopPropagation(); // Disable clicking prevents the sidebar from opening
  };
  const { close: closePanel } = useNodeFormPanel();
  const handleDelete = () => {
    ctx.get<CommandService>(CommandService).executeCommand(FlowCommandId.DELETE, [node]);
  };
  const handleClose = () => {
    closePanel();
  };
  useEffect(() => {
    // 折叠 loop 子节点
    if (node.flowNodeType === "loop") {
      toggleLoopExpanded(node, expanded);
    }
  }, [expanded]);

  return (
    <Header>
      {getIcon(node)}
      <TitleInput readonly={readonly} updateTitleEdit={updateTitleEdit} titleEdit={titleEdit} />
      <HeaderMeta>{registry.meta.nodePanelLabel ?? node.flowNodeType}</HeaderMeta>
      {node.renderData.expandable && !isSidebar && (
        <Button
          type="primary"
          icon={expanded ? <IconSmallTriangleDown /> : <IconSmallTriangleLeft />}
          size="small"
          theme="borderless"
          onClick={handleExpand}
        />
      )}
      {readonly ? undefined : (
        <Operators>
          <NodeMenu
            node={node}
            deleteNode={handleDelete}
            updateTitleEdit={updateTitleEdit}
            canEditTitle={isSidebar}
          />
        </Operators>
      )}
      {isSidebar && (
        <Button
          type="primary"
          icon={<IconClose />}
          size="small"
          theme="borderless"
          onClick={handleClose}
        />
      )}
    </Header>
  );
}
