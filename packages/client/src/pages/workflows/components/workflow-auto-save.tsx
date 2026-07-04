/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { FlowNodeEntity, FormModelV2 } from "@flowgram.ai/free-layout-editor";
import {
  FlowNodeFormData,
  GlobalScope,
  useClientContext,
  useService,
} from "@flowgram.ai/free-layout-editor";
import { debounce } from "lodash-es";
import { useEffect, useMemo } from "react";

import { serializeWorkflowSchema, useWorkflowSave } from "../context";

const AUTO_SAVE_DELAY = 1000;

interface DisposableLike {
  dispose(): void;
}

export function WorkflowAutoSave() {
  const clientContext = useClientContext();
  const globalScope = useService(GlobalScope);
  const { queueSave } = useWorkflowSave();

  const scheduleSave = useMemo(
    () =>
      debounce(() => {
        if (clientContext.document.disposed) {
          return;
        }

        queueSave(serializeWorkflowSchema(clientContext));
      }, AUTO_SAVE_DELAY),
    [clientContext, queueSave],
  );

  useEffect(
    () => () => {
      scheduleSave.flush();
      scheduleSave.cancel();
    },
    [scheduleSave],
  );

  useEffect(() => {
    const documentDisposers: DisposableLike[] = [];
    const formDisposers = new Map<string, DisposableLike>();

    const unwatchNode = (node: FlowNodeEntity) => {
      formDisposers.get(node.id)?.dispose();
      formDisposers.delete(node.id);
    };

    const watchNode = (node: FlowNodeEntity) => {
      if (formDisposers.has(node.id)) {
        return;
      }

      try {
        const formModel = node.getData(FlowNodeFormData).getFormModel<FormModelV2>();
        const disposer = formModel.onFormValuesChange(() => scheduleSave());
        formDisposers.set(node.id, disposer);
      } catch {
        // Some infrastructure nodes do not own a form model.
      }
    };

    clientContext.document.getAllNodes().forEach(watchNode);

    documentDisposers.push(clientContext.document.onContentChange(() => scheduleSave()));
    documentDisposers.push(
      clientContext.document.onNodeCreate(({ node }) => {
        watchNode(node);
        scheduleSave();
      }),
    );
    documentDisposers.push(
      clientContext.document.onNodeDispose(({ node }) => {
        unwatchNode(node);
        scheduleSave();
      }),
    );
    documentDisposers.push(globalScope.output.onVariableListChange(() => scheduleSave()));

    return () => {
      scheduleSave.flush();
      scheduleSave.cancel();
      documentDisposers.forEach((disposer) => disposer.dispose());
      formDisposers.forEach((disposer) => disposer.dispose());
      formDisposers.clear();
    };
  }, [clientContext, globalScope, scheduleSave]);

  return null;
}
