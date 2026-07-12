/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import {
  useCreateWorkflowMutation,
  useUpdateWorkflowMutation,
  useWorkflowDetailQuery,
} from "@buildingai/services/web";
import { Button } from "@buildingai/ui/components/ui/button";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { unstableSetCreateRoot } from "@flowgram.ai/form-materials";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { WorkflowNameDialog } from "./components/workflow-name-dialog";
import { Editor } from "./editor";
import { initialData } from "./initial-data";
import type { FlowDocumentJSON } from "./typings";
import { normalizeWorkflowSchema } from "./utils/llm-schema";

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
    return normalizeWorkflowSchema(schema as FlowDocumentJSON);
  }

  return initialData;
}

export default function WorkflowEditorApp() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);

  const createWorkflowMutation = useCreateWorkflowMutation({
    onSuccess: (workflow) => {
      toast.success("工作流已创建");
      navigate(`/workflows/${workflow.id}`, { replace: true });
    },
    onError: (error) => toast.error(error.message || "工作流创建失败"),
  });

  const updateWorkflowMutation = useUpdateWorkflowMutation({
    onSuccess: () => {
      setRenameDialogOpen(false);
      toast.success("工作流名称已更新");
    },
    onError: (error) => toast.error(error.message || "工作流重命名失败"),
  });

  const workflowQuery = useWorkflowDetailQuery(id, {
    enabled: !!id && id !== "new",
    refetchOnMount: "always",
  });

  if (!id) {
    return (
      <div className="flex h-full min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-muted-foreground text-sm">工作流地址无效</p>
      </div>
    );
  }

  if (id === "new") {
    return (
      <div className="bg-muted/20 h-full min-h-[calc(100vh-64px)]">
        <WorkflowNameDialog
          mode="create"
          open
          isPending={createWorkflowMutation.isPending}
          onOpenChange={(open) => {
            if (!open) navigate("/workflows", { replace: true });
          }}
          onSubmit={(name) =>
            createWorkflowMutation.mutate({
              name,
              description: "",
              schema: initialData as unknown as Record<string, unknown>,
            })
          }
        />
      </div>
    );
  }

  if (workflowQuery.isLoading) {
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
      <div className="bg-background absolute top-3 left-3 z-30 flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-md border p-1 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate("/workflows")}
          aria-label="返回工作流列表"
          title="返回工作流列表"
        >
          <ArrowLeft />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="max-w-[calc(100vw-10rem)] min-w-0 justify-start"
          onClick={() => setRenameDialogOpen(true)}
          title="重命名工作流"
        >
          <span className="truncate">{workflow.name}</span>
          <Pencil className="shrink-0" />
        </Button>
      </div>
      <Editor
        key={workflow.id}
        workflowId={workflow.id}
        initialData={resolveWorkflowSchema(workflow.schema)}
      />
      <WorkflowNameDialog
        mode="rename"
        open={renameDialogOpen}
        initialName={workflow.name}
        isPending={updateWorkflowMutation.isPending}
        onOpenChange={setRenameDialogOpen}
        onSubmit={(name) => updateWorkflowMutation.mutate({ id: workflow.id, dto: { name } })}
      />
    </div>
  );
}
