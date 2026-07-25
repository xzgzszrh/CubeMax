/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconChevronDownStroked, IconIssueStroked } from "@douyinfe/semi-icons";
import { Popover, Tag, TreeSelect } from "@douyinfe/semi-ui";
import type { TreeNodeData } from "@douyinfe/semi-ui/lib/es/tree";
import type { VariableSelectorProps } from "@flowgram.ai/form-materials";
import { useVariableTree } from "@flowgram.ai/form-materials";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

export function FlowVariableSelector({
  value,
  config = {},
  onChange,
  style,
  readonly = false,
  includeSchema,
  excludeSchema,
  hasError,
  triggerRender,
}: VariableSelectorProps) {
  const treeData = useVariableTree({ includeSchema, excludeSchema });
  const rootKeys = treeData
    .filter((node) => node.children?.length)
    .map((node) => String(node.key ?? node.value));
  const rootKeysSignature = JSON.stringify(rootKeys);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(rootKeys);

  useEffect(() => {
    const nextRootKeys = JSON.parse(rootKeysSignature) as string[];
    setExpandedKeys((currentKeys) => Array.from(new Set([...currentKeys, ...nextRootKeys])));
  }, [rootKeysSignature]);

  const treeValue = useMemo(() => {
    if (typeof value === "string") return value;
    return value?.join(".");
  }, [value]);

  const expandRootGroups = (visible: boolean) => {
    if (!visible) return;
    setExpandedKeys((currentKeys) => Array.from(new Set([...currentKeys, ...rootKeys])));
  };

  return (
    <TreeSelect
      className={`gedit-m-variable-selector-tree-select ${hasError ? "error" : ""}`}
      dropdownMatchSelectWidth={false}
      disabled={readonly}
      treeData={treeData}
      expandedKeys={expandedKeys}
      onExpand={(keys) => setExpandedKeys(keys)}
      onVisibleChange={expandRootGroups}
      size="small"
      value={treeValue}
      clearIcon={null}
      style={style}
      validateStatus={hasError ? "error" : undefined}
      dropdownClassName="gedit-m-variable-selector-dropdown"
      onChange={(_, node) => onChange((node as TreeNodeData).keyPath as string[])}
      renderSelectedItem={(node: TreeNodeData) => {
        if (!node?.keyPath) {
          return (
            <Tag
              className="gedit-m-variable-selector-tag"
              prefixIcon={<IconIssueStroked />}
              color="amber"
              closable={!readonly}
              onClose={() => onChange(undefined)}
            >
              {config.notFoundContent ?? "变量不可用"}
            </Tag>
          );
        }

        const rootIcon = renderIcon(node.rootMeta?.icon || node.icon);
        const rootTitle = (
          <div className="gedit-m-variable-selector-root-title">
            {node.rootMeta?.title ? `${node.rootMeta.title} ${node.isRoot ? "" : "-"} ` : null}
          </div>
        );

        return (
          <div>
            <Popover
              content={
                <div className="gedit-m-variable-selector-tag-pop">
                  {rootIcon}
                  {rootTitle}
                  <div className="gedit-m-variable-selector-var-name">
                    {(node.keyPath as string[]).slice(1).join(".")}
                  </div>
                </div>
              }
            >
              <Tag
                className="gedit-m-variable-selector-tag"
                prefixIcon={rootIcon}
                closable={!readonly}
                onClose={() => onChange(undefined)}
              >
                {rootTitle}
                {!node.isRoot && (
                  <div className="gedit-m-variable-selector-var-name in-selector">{node.label}</div>
                )}
              </Tag>
            </Popover>
          </div>
        );
      }}
      showClear={false}
      arrowIcon={<IconChevronDownStroked size="small" />}
      triggerRender={triggerRender}
      placeholder={config.placeholder ?? "选择变量"}
    />
  );
}

function renderIcon(icon: ReactNode): ReactNode {
  if (typeof icon === "string") {
    return <img style={{ marginRight: 8 }} width={12} height={12} src={icon} alt="" />;
  }
  return icon;
}
