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
  CircuitBoard,
  Code2,
  MessageCircle,
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

import { PageShell } from "../_components/page-shell";
import { applicationInitialData, initialData } from "../workflows/initial-data";
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

function getProjectTypeMeta(project: ProgrammingProjectItem) {
  return project.projectType === "application"
    ? {
        label: "应用",
        icon: CircuitBoard,
        className:
          "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
      }
    : {
        label: "对话流",
        icon: MessageCircle,
        className:
          "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
      };
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
    <>
      <PageShell
        icon={Code2}
        title="编程"
        description={`${projectsQuery.data?.total ?? 0} 个工程`}
        actions={
          <>
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
          </>
        }
      >
        {projectsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="bg-background flex min-h-44 flex-col rounded-lg border p-4 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <Skeleton className="size-10 rounded-lg" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
                <Skeleton className="mt-5 h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
                <Skeleton className="mt-auto h-3 w-3/5" />
              </div>
            ))}
          </div>
        ) : projectsQuery.isError ? (
          <Empty className="bg-background min-h-72 rounded-lg border-dashed shadow-xs">
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
          <Empty className="bg-background min-h-72 rounded-lg border-dashed shadow-xs">
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="group bg-background hover:border-foreground/25 relative flex min-h-44 cursor-pointer flex-col rounded-lg border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-sm"
              >
                <button
                  type="button"
                  className="focus-visible:ring-ring/50 absolute inset-0 rounded-lg text-left outline-none focus-visible:ring-[3px]"
                  onClick={() => navigate(`/programming/${project.id}/program`)}
                  aria-label={`打开工程 ${project.name}`}
                />
                <div className="pointer-events-none relative flex items-start gap-3">
                  <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                    {(() => {
                      const ProjectTypeIcon = getProjectTypeMeta(project).icon;
                      return <ProjectTypeIcon className="size-5" />;
                    })()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2 pr-8">
                      <h2 className="truncate text-sm font-semibold">{project.name}</h2>
                      <Badge
                        variant="outline"
                        className={`shrink-0 font-normal ${getProjectTypeMeta(project).className}`}
                      >
                        {getProjectTypeMeta(project).label}
                      </Badge>
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
      </PageShell>

      <ProjectNameDialog
        mode="create"
        open={createDialogOpen}
        isPending={createMutation.isPending}
        onOpenChange={setCreateDialogOpen}
        onSubmit={({ name, description, projectType }) =>
          createMutation.mutate({
            name,
            description,
            projectType,
            schema:
              projectType === "application"
                ? (applicationInitialData as unknown as Record<string, unknown>)
                : (initialData as unknown as Record<string, unknown>),
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
    </>
  );
}
