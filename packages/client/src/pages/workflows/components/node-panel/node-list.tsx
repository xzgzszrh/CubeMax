/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { WorkflowNodeEntity, WorkflowPortEntity } from "@flowgram.ai/free-layout-editor";
import { useClientContext } from "@flowgram.ai/free-layout-editor";
import type { NodePanelRenderProps } from "@flowgram.ai/free-node-panel-plugin";
import type { FC } from "react";
import React from "react";
import styled from "styled-components";

import { nodeRegistries, WorkflowNodeType } from "../../nodes";
import type { FlowNodeRegistry } from "../../typings";
import { canContainNode } from "../../utils";

const DEFAULT_NODE_PANEL_GROUP = {
  id: "general",
  label: "通用",
};

const NodeWrap = styled.div`
  width: 100%;
  height: 32px;
  border-radius: 5px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 10px;
  &:hover {
    background-color: hsl(252deg 62% 55% / 9%);
    color: hsl(252 62% 54.9%);
  }
`;

const NodeLabel = styled.div`
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 10px;
`;

const NodeGroupTitle = styled.div`
  color: rgba(28, 31, 35, 0.55);
  font-size: 11px;
  font-weight: 600;
  line-height: 20px;
  padding: 8px 10px 4px;
`;

const NodeGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 6px;
  row-gap: 2px;
`;

interface NodeProps {
  label: string;
  testId: string;
  icon: React.ReactNode;
  onClick: React.MouseEventHandler<HTMLDivElement>;
  disabled: boolean;
}

function Node(props: NodeProps) {
  return (
    <NodeWrap
      data-testid={`demo-free-node-list-${props.testId}`}
      onClick={props.disabled ? undefined : props.onClick}
      style={props.disabled ? { opacity: 0.3 } : {}}
      title={props.label}
    >
      <div style={{ fontSize: 14 }}>{props.icon}</div>
      <NodeLabel>{props.label}</NodeLabel>
    </NodeWrap>
  );
}

const NodesWrap = styled.div`
  width: 420px;
  max-height: 520px;
  box-sizing: border-box;
  overflow: auto;
  padding: 6px;
  &::-webkit-scrollbar {
    display: none;
  }
`;

interface NodeListProps {
  onSelect: NodePanelRenderProps["onSelect"];
  fromPort?: WorkflowPortEntity; // 从哪个端口添加 From which port to add
  containerNode?: WorkflowNodeEntity;
}

function getVisibleRegistries(params: {
  containerNode: WorkflowNodeEntity | undefined;
  fromPort?: WorkflowPortEntity;
}): FlowNodeRegistry[] {
  const { containerNode, fromPort } = params;

  return nodeRegistries
    .filter((register) => register.meta.nodePanelVisible !== false)
    .filter((register) => {
      if (fromPort && register.type === WorkflowNodeType.Comment) {
        return false;
      }
      if (register.meta.onlyInContainer) {
        return register.meta.onlyInContainer === containerNode?.flowNodeType;
      }
      /**
       * 循环节点无法嵌套循环节点
       * Loop node cannot nest loop node
       */
      if (containerNode && !canContainNode(register.type, containerNode.flowNodeType)) {
        return false;
      }
      return true;
    });
}

function groupRegistries(registries: FlowNodeRegistry[]) {
  const groups: Array<{
    id: string;
    label: string;
    registries: FlowNodeRegistry[];
  }> = [];

  registries.forEach((registry) => {
    const id = registry.meta.nodePanelGroup ?? DEFAULT_NODE_PANEL_GROUP.id;
    const label = registry.meta.nodePanelGroupLabel ?? DEFAULT_NODE_PANEL_GROUP.label;
    let group = groups.find((item) => item.id === id);

    if (!group) {
      group = {
        id,
        label,
        registries: [],
      };
      groups.push(group);
    }

    group.registries.push(registry);
  });

  return groups;
}

export const NodeList: FC<NodeListProps> = (props) => {
  const { onSelect, containerNode, fromPort } = props;
  const context = useClientContext();
  const handleClick = (e: React.MouseEvent, registry: FlowNodeRegistry) => {
    const json = registry.onAdd?.(context);
    onSelect({
      nodeType: registry.type as string,
      selectEvent: e,
      nodeJSON: json,
    });
  };
  const groups = groupRegistries(getVisibleRegistries({ containerNode, fromPort }));

  return (
    <NodesWrap>
      {groups.map((group) => (
        <React.Fragment key={group.id}>
          {groups.length > 1 && <NodeGroupTitle>{group.label}</NodeGroupTitle>}
          <NodeGroup>
            {group.registries.map((registry) => (
              <Node
                key={registry.type}
                disabled={!(registry.canAdd?.(context) ?? true)}
                icon={
                  <img
                    alt=""
                    style={{ width: 12, height: 12, borderRadius: 4, display: "block" }}
                    src={registry.info?.icon}
                  />
                }
                label={registry.meta.nodePanelLabel ?? (registry.type as string)}
                testId={registry.type as string}
                onClick={(e) => handleClick(e, registry)}
              />
            ))}
          </NodeGroup>
        </React.Fragment>
      ))}
    </NodesWrap>
  );
};
