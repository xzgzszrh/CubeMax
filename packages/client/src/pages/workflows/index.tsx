import {
  useCreateWorkflowMutation,
  useUpdateWorkflowMutation,
  useWorkflowListQuery,
  type WorkflowItem,
} from "@buildingai/services/web";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@buildingai/ui/components/ui/empty";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@buildingai/ui/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@buildingai/ui/components/ui/item";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { ArrowRight, FileText, Pencil, Plus, RefreshCw, Workflow } from "lucide-react";
import { useState } from "react";

import { WorkflowNameDialog } from "./components/workflow-name-dialog";
import { initialData } from "./initial-data";

const PAGE_SIZE = 50;

function formatWorkflowTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNodeCount(workflow: WorkflowItem) {
  const nodes = workflow.schema?.nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}

export default function WorkflowsIndexPage() {
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renamingWorkflow, setRenamingWorkflow] = useState<WorkflowItem | null>(null);
  const workflowsQuery = useWorkflowListQuery({ page: 1, pageSize: PAGE_SIZE });
  const workflows = workflowsQuery.data?.items ?? [];

  const createWorkflowMutation = useCreateWorkflowMutation({
    onSuccess: (workflow) => {
      setCreateDialogOpen(false);
      toast.success("工作流已创建");
      navigate(`/workflows/${workflow.id}`);
    },
    onError: (error) => toast.error(error.message || "工作流创建失败"),
  });

  const updateWorkflowMutation = useUpdateWorkflowMutation({
    onSuccess: () => {
      setRenamingWorkflow(null);
      toast.success("工作流名称已更新");
    },
    onError: (error) => toast.error(error.message || "工作流重命名失败"),
  });

  const handleCreate = (name: string) => {
    createWorkflowMutation.mutate({
      name,
      description: "",
      schema: initialData as unknown as Record<string, unknown>,
    });
  };

  const handleRename = (name: string) => {
    if (!renamingWorkflow) return;
    updateWorkflowMutation.mutate({ id: renamingWorkflow.id, dto: { name } });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">工作流</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            共 {workflowsQuery.data?.total ?? 0} 个工作流
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => workflowsQuery.refetch()}
            disabled={workflowsQuery.isFetching}
            aria-label="刷新"
          >
            <RefreshCw className={workflowsQuery.isFetching ? "animate-spin" : undefined} />
          </Button>
          <Button type="button" onClick={() => setCreateDialogOpen(true)}>
            <Plus />
            新建工作流
          </Button>
        </div>
      </div>

      {workflowsQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : workflowsQuery.isError ? (
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Workflow />
            </EmptyMedia>
            <EmptyTitle>工作流加载失败</EmptyTitle>
            <EmptyDescription>请检查后端服务和数据库连接状态。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" onClick={() => workflowsQuery.refetch()}>
              <RefreshCw />
              重试
            </Button>
          </EmptyContent>
        </Empty>
      ) : workflows.length === 0 ? (
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Workflow />
            </EmptyMedia>
            <EmptyTitle>暂无工作流</EmptyTitle>
            <EmptyDescription>创建一个工作流后，它会显示在这里。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => setCreateDialogOpen(true)}>
              <Plus />
              新建工作流
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ItemGroup>
          {workflows.map((workflow) => (
            <Item
              key={workflow.id}
              variant="outline"
              className="bg-background hover:bg-muted/50 flex-nowrap p-0"
            >
              <button
                type="button"
                className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3.5 rounded-md px-4 py-3.5 text-left outline-none focus-visible:ring-[3px]"
                onClick={() => navigate(`/workflows/${workflow.id}`)}
              >
                <ItemMedia variant="icon" className="text-primary">
                  <FileText />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{workflow.name}</ItemTitle>
                  <ItemDescription>
                    {workflow.description?.trim() || "无描述"} · {getNodeCount(workflow)} 个节点 ·
                    更新于 {formatWorkflowTime(workflow.updatedAt)}
                  </ItemDescription>
                </ItemContent>
                <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              </button>
              <ItemActions className="pr-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRenamingWorkflow(workflow)}
                  aria-label={`重命名${workflow.name}`}
                  title="重命名"
                >
                  <Pencil />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}

      <WorkflowNameDialog
        mode="create"
        open={createDialogOpen}
        isPending={createWorkflowMutation.isPending}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreate}
      />
      <WorkflowNameDialog
        mode="rename"
        open={renamingWorkflow !== null}
        initialName={renamingWorkflow?.name}
        isPending={updateWorkflowMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setRenamingWorkflow(null);
        }}
        onSubmit={handleRename}
      />
    </div>
  );
}
