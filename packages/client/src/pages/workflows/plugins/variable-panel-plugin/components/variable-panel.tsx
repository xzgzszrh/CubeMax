/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useState } from "react";

import { Collapsible, IconButton, Tabs, Tooltip } from "@douyinfe/semi-ui";
import { Braces } from "lucide-react";

import { GlobalVariableEditor } from "./global-variable-editor";
import { FullVariableList } from "./full-variable-list";

import styles from "./index.module.less";

export function VariablePanel() {
  const [isOpen, setOpen] = useState<boolean>(false);

  return (
    <div className={styles["panel-wrapper"]} data-open={isOpen || undefined}>
      <Tooltip content={isOpen ? "关闭变量面板" : "打开变量面板"}>
        <IconButton
          className={`${styles["variable-panel-button"]} ${isOpen ? styles.active : ""}`}
          type="tertiary"
          theme="borderless"
          icon={<Braces aria-hidden="true" />}
          onClick={() => setOpen((_open) => !_open)}
          aria-label={isOpen ? "关闭变量面板" : "打开变量面板"}
          aria-expanded={isOpen}
          data-testid="workflow.variable-panel.toggle"
        />
      </Tooltip>
      <Collapsible isOpen={isOpen}>
        <div className={styles["panel-container"]} data-testid="workflow.variable-panel.content">
          <Tabs>
            <Tabs.TabPane itemKey="variables" tab="变量列表">
              <FullVariableList />
            </Tabs.TabPane>
            <Tabs.TabPane itemKey="global" tab="全局变量">
              <GlobalVariableEditor />
            </Tabs.TabPane>
          </Tabs>
        </div>
      </Collapsible>
    </div>
  );
}
