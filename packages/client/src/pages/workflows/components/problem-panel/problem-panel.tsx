/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { Badge, IconButton, Spin, Tooltip } from "@douyinfe/semi-ui";
import { useService, WorkflowSelectService } from "@flowgram.ai/free-layout-editor";
import { CheckCircle2, ListChecks, X } from "lucide-react";

import { useProblemPanel, useNodeFormPanel } from "../../plugins/panel-manager-plugin/hooks";
import type { ValidateResult } from "../../services/validate-service";
import { useWatchValidate } from "./use-watch-validate";

import styles from "./problem-panel.module.less";

function getNodeTitle(result: ValidateResult): string {
  const title = result.node.form?.values.title;
  if (typeof title === "string" && title.trim()) return title;

  return result.node.getNodeMeta().nodePanelLabel || String(result.node.flowNodeType);
}

export const ProblemPanel = () => {
  const { results, loading } = useWatchValidate();

  const selectService = useService(WorkflowSelectService);

  const { close: closePanel } = useProblemPanel();
  const { open: openNodeFormPanel } = useNodeFormPanel();

  return (
    <section className={styles.panel} aria-label="编程检查清单">
      <header className={styles.header}>
        <div className={styles["header-copy"]}>
          <div className={styles["title-row"]}>
            <h2 className={styles.title}>检查清单（{results.length}）</h2>
            {loading && <Spin size="small" />}
          </div>
          <p className={styles.subtitle}>发布前请解决以下问题</p>
        </div>
        <IconButton
          aria-label="关闭检查清单"
          className={styles.close}
          type="tertiary"
          theme="borderless"
          icon={<X aria-hidden="true" size={17} />}
          onClick={() => closePanel()}
        />
      </header>

      <div className={styles.content}>
        {!loading && results.length === 0 ? (
          <div className={styles.empty}>
            <CheckCircle2 aria-hidden="true" size={30} />
            <strong>未发现问题</strong>
            <span>当前编程已通过检查</span>
          </div>
        ) : (
          results.map((result) => (
            <button
              type="button"
              key={result.node.id}
              className={styles["node-item"]}
              aria-label={`定位到节点：${getNodeTitle(result)}`}
              onClick={() => {
                selectService.selectNodeAndScrollToView(result.node);
                openNodeFormPanel({ nodeId: result.node.id });
              }}
            >
              <div className={styles["node-header"]}>
                <img
                  className={styles["node-icon"]}
                  src={result.node.getNodeRegistry().info?.icon}
                  alt=""
                />
                <span className={styles["node-title"]}>{getNodeTitle(result)}</span>
              </div>
              <ul className={styles.issues}>
                {result.feedbacks.map((feedback) => (
                  <li key={feedback.id}>{feedback.feedbackText}</li>
                ))}
              </ul>
            </button>
          ))
        )}
      </div>
    </section>
  );
};

export const ProblemButton = () => {
  const { open } = useProblemPanel();
  const { results, loading } = useWatchValidate();

  const button = (
    <IconButton
      aria-label={results.length ? `检查清单，${results.length} 个节点存在问题` : "检查清单"}
      type="tertiary"
      theme="borderless"
      icon={<ListChecks aria-hidden="true" size={18} />}
      loading={loading && results.length === 0}
      onClick={() => open()}
    />
  );

  return (
    <Tooltip content="检查清单">
      {results.length ? (
        <Badge count={results.length} overflowCount={99} position="rightTop" type="danger">
          {button}
        </Badge>
      ) : (
        button
      )}
    </Tooltip>
  );
};
