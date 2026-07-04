/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useCreateWorkflowMutation, useWorkflowDetailQuery } from "@buildingai/services/web";
import { Button } from "@buildingai/ui/components/ui/button";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { unstableSetCreateRoot } from "@flowgram.ai/form-materials";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useNavigate, useParams } from "react-router-dom";

import { Editor } from "./editor";
import { initialData } from "./initial-data";
import type { FlowDocumentJSON } from "./typings";

/**
 * React 18/19 polyfill for form-materials
 */
unstableSetCreateRoot(createRoot);

function resolveWorkflowSchema(schema: unknown): FlowDocumentJSON {
  if (
    schema &&
    typeof schema === "object" &&
    Array.isArray((schema as FlowDocumentJSON).nodes) &&
    Array.isArray((schema as FlowDocumentJSON).edges)
  ) {
    return schema as FlowDocumentJSON;
  }

  return initialData;
}

export default function WorkflowEditorApp() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const createStartedRef = useRef(false);

  const { mutate: createWorkflow } = useCreateWorkflowMutation({
    onSuccess: (workflow) => {
      navigate(`/workflows/${workflow.id}`, { replace: true });
    },
  });

  const workflowQuery = useWorkflowDetailQuery(id, {
    enabled: !!id && id !== "new",
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (id !== "new" || createStartedRef.current) return;

    createStartedRef.current = true;
    createWorkflow({
      name: "未命名工作流",
      description: "",
      schema: initialData as unknown as Record<string, unknown>,
    });
  }, [createWorkflow, id]);

  if (!id) {
    return (
      <div className="flex h-full min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-muted-foreground text-sm">工作流地址无效</p>
      </div>
    );
  }

  if (id === "new" || workflowQuery.isLoading) {
    return (
      <div className="flex h-full min-h-[calc(100vh-64px)] flex-col gap-3 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="min-h-[calc(100vh-144px)] w-full flex-1" />
      </div>
    );
  }

  if (workflowQuery.isError || !workflowQuery.data) {
    return (
      <div className="flex h-full min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-sm">工作流加载失败</p>
        <Button type="button" variant="outline" onClick={() => workflowQuery.refetch()}>
          <RefreshCw />
          重试
        </Button>
      </div>
    );
  }

  const workflow = workflowQuery.data;

  return (
    <div className="relative h-full min-h-[calc(100vh-64px)]">
      <Editor
        key={workflow.id}
        workflowId={workflow.id}
        initialData={resolveWorkflowSchema(workflow.schema)}
      />
    </div>
  );
}
