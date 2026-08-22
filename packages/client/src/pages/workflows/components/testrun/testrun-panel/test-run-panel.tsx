/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconClose, IconPlay, IconSpin } from "@douyinfe/semi-icons";
import { Button, Switch } from "@douyinfe/semi-ui";
import { usePlaygroundContainer } from "@flowgram.ai/free-layout-editor";
import type { WorkflowInputs, WorkflowOutputs } from "@flowgram.ai/runtime-interface";
import classnames from "classnames";
import type { FC } from "react";
import { useEffect, useState } from "react";

import { IconCancel } from "../../../assets/icon-cancel";
import { useTestRunFormPanel } from "../../../plugins/panel-manager-plugin/hooks";
import { getWorkflowRuntimeService } from "../../../plugins/runtime-plugin/runtime-service";
import { NodeStatusGroup } from "../node-status-bar/group";
import { TestRunForm } from "../testrun-form";
import { TestRunJsonInput } from "../testrun-json-input";
import styles from "./index.module.less";

export interface TestRunSidePanelProps {}

export const TestRunSidePanel: FC<TestRunSidePanelProps> = () => {
  const runtimeService = getWorkflowRuntimeService(usePlaygroundContainer());
  const { close: closePanel } = useTestRunFormPanel();
  const [isRunning, setRunning] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<string[]>();
  const [result, setResult] = useState<
    | {
        inputs: WorkflowInputs;
        outputs: WorkflowOutputs;
      }
    | undefined
  >();

  // en - Use localStorage to persist the JSON mode state
  const [inputJSONMode, _setInputJSONMode] = useState(() => {
    const savedMode = localStorage.getItem("testrun-input-json-mode");
    return savedMode ? JSON.parse(savedMode) : false;
  });

  const setInputJSONMode = (checked: boolean) => {
    _setInputJSONMode(checked);
    localStorage.setItem("testrun-input-json-mode", JSON.stringify(checked));
  };

  const onTestRun = async () => {
    if (!runtimeService) return;
    if (isRunning) {
      await runtimeService.taskCancel();
      return;
    }
    setResult(undefined);
    setErrors(undefined);
    const taskID = await runtimeService.taskRun(values);
    if (taskID) {
      setRunning(true);
    }
  };

  const onClose = async () => {
    await runtimeService?.taskCancel();
    setValues({});
    setRunning(false);
    closePanel();
  };

  const renderRunning = (
    <div className={styles["testrun-panel-running"]}>
      <IconSpin spin size="large" />
      <div className={styles.text}>运行中...</div>
    </div>
  );

  const renderForm = (
    <div className={styles["testrun-panel-form"]}>
      <div className={styles["testrun-panel-input"]}>
        <div className={styles.title}>输入表单</div>
        <div className={styles.hint} style={{ fontSize: 12, color: "var(--semi-color-text-2)", marginBottom: 8 }}>
          用 CubeMax 连接：目标手机须已登录且 App 保持前台。含「手机摄像头」或「视觉识别」节点时请在节点中指定拍摄设备，或从手机运行。
        </div>
        <div>JSON 模式</div>
        <Switch
          checked={inputJSONMode}
          onChange={(checked: boolean) => setInputJSONMode(checked)}
          size="small"
        />
      </div>
      {inputJSONMode ? (
        <TestRunJsonInput values={values} setValues={setValues} />
      ) : (
        <TestRunForm values={values} setValues={setValues} />
      )}
      {errors?.map((e) => (
        <div className={styles.error} key={e}>
          {e}
        </div>
      ))}
      <NodeStatusGroup title="输入结果" data={result?.inputs} optional disableCollapse />
      <NodeStatusGroup title="输出结果" data={result?.outputs} optional disableCollapse />
    </div>
  );

  const renderButton = (
    <Button
      onClick={onTestRun}
      icon={isRunning ? <IconCancel /> : <IconPlay size="small" />}
      className={classnames(styles.button, {
        [styles.running]: isRunning,
        [styles.default]: !isRunning,
      })}
    >
      {isRunning ? "取消" : "测试运行"}
    </Button>
  );

  useEffect(() => {
    if (!runtimeService) return;
    const disposer = runtimeService.onResultChanged(({ result, errors }) => {
      setRunning(false);
      setResult(result);
      if (errors) {
        setErrors(errors);
      } else {
        setErrors(undefined);
      }
    });
    return () => disposer.dispose();
  }, [runtimeService]);

  useEffect(
    () => () => {
      runtimeService?.taskCancel();
    },
    [runtimeService],
  );

  return (
    <div className={styles["testrun-panel-container"]}>
      <div className={styles["testrun-panel-header"]}>
        <div className={styles["testrun-panel-title"]}>测试运行</div>
        <Button
          className={styles["testrun-panel-title"]}
          type="tertiary"
          icon={<IconClose />}
          size="small"
          theme="borderless"
          onClick={onClose}
        />
      </div>
      <div className={styles["testrun-panel-content"]}>
        {isRunning ? renderRunning : renderForm}
      </div>
      <div className={styles["testrun-panel-footer"]}>{renderButton}</div>
    </div>
  );
};
