/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { IconSaveStroked } from "@douyinfe/semi-icons";
import { Badge, Button, IconButton, Tooltip } from "@douyinfe/semi-ui";
import type { FlowNodeEntity } from "@flowgram.ai/free-layout-editor";
import { useClientContext } from "@flowgram.ai/free-layout-editor";
import { useCallback, useEffect, useState } from "react";

import { serializeWorkflowSchema, useWorkflowSave } from "../../context";

export function Save(props: { disabled: boolean; compact?: boolean }) {
  const [errorCount, setErrorCount] = useState(0);
  const clientContext = useClientContext();
  const { saveSchema, saving } = useWorkflowSave();

  const updateValidateData = useCallback(() => {
    const allForms = clientContext.document.getAllNodes().map((node) => node.form);
    const count = allForms.filter((form) => form?.state.invalid).length;
    setErrorCount(count);
  }, [clientContext]);

  /**
   * Validate all node and Save
   */
  const onSave = useCallback(async () => {
    const allForms = clientContext.document.getAllNodes().map((node) => node.form);
    await Promise.all(allForms.map(async (form) => form?.validate()));
    await saveSchema(serializeWorkflowSchema(clientContext), { showSuccessToast: true });
  }, [clientContext, saveSchema]);

  /**
   * Listen single node validate
   */
  useEffect(() => {
    const listenSingleNodeValidate = (node: FlowNodeEntity) => {
      const { form } = node;
      if (form) {
        const formValidateDispose = form.onValidate(() => updateValidateData());
        node.onDispose(() => formValidateDispose.dispose());
      }
    };
    clientContext.document.getAllNodes().forEach((node) => listenSingleNodeValidate(node));
    const dispose = clientContext.document.onNodeCreate(({ node }) =>
      listenSingleNodeValidate(node),
    );
    return () => dispose.dispose();
  }, [clientContext, updateValidateData]);

  if (props.compact) {
    const button = (
      <IconButton
        aria-label="保存"
        disabled={props.disabled || saving}
        icon={<IconSaveStroked />}
        loading={saving}
        onClick={onSave}
        theme="borderless"
        type={errorCount === 0 ? "tertiary" : "danger"}
      />
    );

    if (errorCount === 0) {
      return <Tooltip content="保存">{button}</Tooltip>;
    }

    return (
      <Badge count={errorCount} position="rightTop" type="danger">
        <Tooltip content="保存">{button}</Tooltip>
      </Badge>
    );
  }

  if (errorCount === 0) {
    return (
      <Button
        disabled={props.disabled || saving}
        loading={saving}
        onClick={onSave}
        style={{ backgroundColor: "rgba(171,181,255,0.3)", borderRadius: "8px" }}
      >
        保存
      </Button>
    );
  }
  return (
    <Badge count={errorCount} position="rightTop" type="danger">
      <Button
        type="danger"
        disabled={props.disabled || saving}
        loading={saving}
        onClick={onSave}
        style={{ backgroundColor: "rgba(255, 179, 171, 0.3)", borderRadius: "8px" }}
      >
        保存
      </Button>
    </Badge>
  );
}
