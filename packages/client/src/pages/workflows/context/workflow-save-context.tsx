/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import {
  programmingProjectQueryKeys,
  updateWorkflow,
  workflowQueryKeys,
} from "@buildingai/services/web";
import type { FreeLayoutPluginContext } from "@flowgram.ai/free-layout-editor";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { GetGlobalVariableSchema } from "../plugins/variable-panel-plugin";
import type { FlowDocumentJSON } from "../typings";
import { normalizeWorkflowSchema } from "../utils/llm-schema";

interface SaveSchemaOptions {
  showSuccessToast?: boolean;
}

interface WorkflowSaveContextValue {
  workflowId: string;
  projectId?: string;
  saving: boolean;
  queueSave: (schema: FlowDocumentJSON) => void;
  saveSchema: (schema: FlowDocumentJSON, options?: SaveSchemaOptions) => Promise<void>;
}

const WorkflowSaveContext = createContext<WorkflowSaveContextValue | null>(null);

export function serializeWorkflowSchema(ctx: FreeLayoutPluginContext): FlowDocumentJSON {
  return normalizeWorkflowSchema({
    ...ctx.document.toJSON(),
    globalVariable: ctx.get<GetGlobalVariableSchema>(GetGlobalVariableSchema)(),
  } as FlowDocumentJSON);
}

export function WorkflowSaveProvider({
  children,
  workflowId,
  projectId,
}: {
  children: React.ReactNode;
  workflowId: string;
  projectId?: string;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const pendingSchemaRef = useRef<FlowDocumentJSON | null>(null);
  const saveTaskRef = useRef<Promise<void> | null>(null);
  const showSuccessToastRef = useRef(false);
  const unmountedRef = useRef(false);

  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    [],
  );

  const runSaveQueue = useCallback(
    async function runSaveQueue() {
      if (saveTaskRef.current) {
        return saveTaskRef.current;
      }

      const task = (async () => {
        if (!unmountedRef.current) {
          setSaving(true);
        }

        try {
          while (pendingSchemaRef.current) {
            const schema = pendingSchemaRef.current;
            pendingSchemaRef.current = null;

            const workflow = await updateWorkflow(workflowId, {
              schema: schema as unknown as Record<string, unknown>,
            });

            queryClient.setQueryData(workflowQueryKeys.detail(workflow.id), workflow);
            void queryClient.invalidateQueries({ queryKey: workflowQueryKeys.listRoot() });
            if (projectId) {
              void queryClient.invalidateQueries({
                queryKey: programmingProjectQueryKeys.detail(projectId),
              });
            }
          }

          if (showSuccessToastRef.current) {
            toast.success(projectId ? "编程画布已保存" : "工作流已保存");
            showSuccessToastRef.current = false;
          }
        } catch (error) {
          showSuccessToastRef.current = false;
          console.error("[Workflow] save failed", error);
          toast.error(projectId ? "编程画布保存失败" : "工作流保存失败");
          throw error;
        } finally {
          saveTaskRef.current = null;

          if (!unmountedRef.current) {
            setSaving(false);
          }

          if (pendingSchemaRef.current && !unmountedRef.current) {
            void runSaveQueue().catch(() => undefined);
          }
        }
      })();

      saveTaskRef.current = task;
      return task;
    },
    [projectId, queryClient, workflowId],
  );

  const queueSave = useCallback(
    (schema: FlowDocumentJSON) => {
      pendingSchemaRef.current = schema;
      void runSaveQueue().catch(() => undefined);
    },
    [runSaveQueue],
  );

  const saveSchema = useCallback(
    async (schema: FlowDocumentJSON, options?: SaveSchemaOptions) => {
      pendingSchemaRef.current = schema;
      if (options?.showSuccessToast) {
        showSuccessToastRef.current = true;
      }

      while (pendingSchemaRef.current || saveTaskRef.current) {
        await runSaveQueue();
      }
    },
    [runSaveQueue],
  );

  const value = useMemo<WorkflowSaveContextValue>(
    () => ({
      queueSave,
      saveSchema,
      saving,
      workflowId,
      projectId,
    }),
    [projectId, queueSave, saveSchema, saving, workflowId],
  );

  return <WorkflowSaveContext.Provider value={value}>{children}</WorkflowSaveContext.Provider>;
}

export function useWorkflowSave() {
  const context = useContext(WorkflowSaveContext);
  if (!context) {
    throw new Error("useWorkflowSave must be used within WorkflowSaveProvider");
  }
  return context;
}
