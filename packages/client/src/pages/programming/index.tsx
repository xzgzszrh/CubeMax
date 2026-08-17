import {
  type ProgrammingProjectItem,
  useCreateProgrammingProjectMutation,
  useDeleteProgrammingProjectMutation,
  useProgrammingProjectsQuery,
  useUpdateProgrammingProjectMutation,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@buildingai/ui/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@buildingai/ui/components/ui/empty";
import { Input } from "@buildingai/ui/components/ui/input";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import {
  ArrowRight,
  Blocks,
  Box,
  Code2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { initialData } from "../workflows/initial-data";
import { ProjectNameDialog } from "./project-name-dialog";

const PAGE_SIZE = 50;

const RUNTIME_LABELS = {
  local: "本地运行",
  simulator: "硬件仿真",
  device: "CubeCat 设备",
} as const;

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNodeCount(project: ProgrammingProjectItem) {
  const nodes = project.mainWorkflow.schema?.nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}

export default function ProgrammingProjectsPage() {
  const navigate = useNavigate();
  const { confirm } = useAlertDialog();
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword.trim());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProgrammingProjectItem | null>(null);
  const projectsQuery = useProgrammingProjectsQuery({
    page: 1,
    pageSize: PAGE_SIZE,
    keyword: deferredKeyword || undefined,
  });
  const projects = projectsQuery.data?.items ?? [];

  const createMutation = useCreateProgrammingProjectMutation({
    onSuccess: (project) => {
      setCreateDialogOpen(false);
      toast.success("工程已创建");
      navigate(`/programming/${project.id}/program`);
    },
    onError: (error) => toast.error(error.message || "工程创建失败"),
  });
  const updateMutation = useUpdateProgrammingProjectMutation({
    onSuccess: () => {
      setEditingProject(null);
      toast.success("工程信息已更新");
    },
    onError: (error) => toast.error(error.message || "工程更新失败"),
  });
  const deleteMutation = useDeleteProgrammingProjectMutation({
    onSuccess: () => toast.success("工程已删除"),
    onError: (error) => toast.error(error.message || "工程删除失败"),
  });

  const handleDelete = async (project: ProgrammingProjectItem) => {
    try {
      await confirm({
        title: "删除工程？",
        description: `工程「${project.name}」中的主流程、Lua 模块和仿真会话将一并删除。`,
        confirmText: "删除工程",
        cancelText: "取消",
        confirmVariant: "destructive",
      });
      await deleteMutation.mutateAsync(project.id);
    } catch (error) {
      if (error instanceof Error && error.message === "AlertDialog cancelled") return;
    }
  };

  return (
    <div className="bg-muted/15 h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-8 md:px-8 md:py-10">
        <header className="flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium uppercase">
              <Code2 className="size-4" /> CubeCat Studio
            </div>
            <h1 className="text-2xl font-semibold">编程</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {projectsQuery.data?.total ?? 0} 个工程
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索工程"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => projectsQuery.refetch()}
              disabled={projectsQuery.isFetching}
              aria-label="刷新工程"
              title="刷新工程"
            >
              <RefreshCw className={projectsQuery.isFetching ? "animate-spin" : undefined} />
            </Button>
            <Button type="button" onClick={() => setCreateDialogOpen(true)}>
              <Plus /> 新建工程
            </Button>
          </div>
        </header>

        <div className="pt-5">
          {projectsQuery.isLoading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full rounded-md" />
              ))}
            </div>
          ) : projectsQuery.isError ? (
            <Empty className="min-h-96 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Blocks />
                </EmptyMedia>
                <EmptyTitle>工程加载失败</EmptyTitle>
                <EmptyDescription>服务暂时不可用。</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => projectsQuery.refetch()}>
                  <RefreshCw /> 重试
                </Button>
              </EmptyContent>
            </Empty>
          ) : projects.length === 0 ? (
            <Empty className="min-h-96 border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Box />
                </EmptyMedia>
                <EmptyTitle>{deferredKeyword ? "没有匹配的工程" : "暂无编程工程"}</EmptyTitle>
                <EmptyDescription>
                  {deferredKeyword ? "尝试调整搜索内容。" : "创建工程后即可编辑主流程和 Lua 模块。"}
                </EmptyDescription>
              </EmptyHeader>
              {!deferredKeyword && (
                <EmptyContent>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus /> 新建工程
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="bg-background hover:border-foreground/20 group relative flex min-h-32 flex-col rounded-md border p-4 transition-colors"
                >
                  <button
                    type="button"
                    className="focus-visible:ring-ring/50 absolute inset-0 rounded-md text-left outline-none focus-visible:ring-[3px]"
                    onClick={() => navigate(`/programming/${project.id}/program`)}
                    aria-label={`打开工程 ${project.name}`}
                  />
                  <div className="pointer-events-none relative flex items-start gap-3">
                    <span className="bg-foreground text-background flex size-10 shrink-0 items-center justify-center rounded-md">
                      <Code2 className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2 pr-8">
                        <h2 className="truncate text-sm font-semibold">{project.name}</h2>
                        <Badge
                          variant="outline"
                          className={
                            project.isPublished
                              ? "shrink-0 border-emerald-200 bg-emerald-50 font-normal text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                              : "text-muted-foreground shrink-0 font-normal"
                          }
                        >
                          {project.isPublished ? "已发布" : "草稿"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 min-h-8 text-xs leading-4">
                        {project.description?.trim() || "无工程说明"}
                      </p>
                    </div>
                  </div>
                  <div className="text-muted-foreground pointer-events-none relative mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs">
                    <span>{getNodeCount(project)} 个节点</span>
                    <span>{project.luaModuleCount} 个 Lua 模块</span>
                    <span>{project.tools.length} 个工具</span>
                    <span>{RUNTIME_LABELS[project.runtimeTarget]}</span>
                    <span className="ml-auto">{formatTime(project.updatedAt)}</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-3 right-3 z-10"
                        aria-label={`${project.name} 的更多操作`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingProject(project)}>
                        <Pencil /> 编辑信息
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => void handleDelete(project)}
                      >
                        <Trash2 /> 删除工程
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <ProjectNameDialog
        mode="create"
        open={createDialogOpen}
        isPending={createMutation.isPending}
        onOpenChange={setCreateDialogOpen}
        onSubmit={({ name, description }) =>
          createMutation.mutate({
            name,
            description,
            schema: initialData as unknown as Record<string, unknown>,
          })
        }
      />
      <ProjectNameDialog
        mode="edit"
        open={editingProject !== null}
        initialName={editingProject?.name}
        initialDescription={editingProject?.description ?? ""}
        isPending={updateMutation.isPending}
        onOpenChange={(open) => !open && setEditingProject(null)}
        onSubmit={(dto) => editingProject && updateMutation.mutate({ id: editingProject.id, dto })}
      />
    </div>
  );
}
