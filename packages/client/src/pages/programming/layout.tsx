import type { ProgrammingProjectItem } from "@buildingai/services/web";
import { useProgrammingProjectQuery } from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@buildingai/ui/components/ui/sidebar";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Code2, Pencil, Radio } from "lucide-react";
import { useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";

import { ProgrammingProjectContext } from "./context";
import { ProjectNameDialog } from "./project-name-dialog";
import { ProgrammingSidebar } from "./workspace-sidebar";

function WorkspaceTopbar({
  project,
  onEdit,
}: {
  project: ProgrammingProjectItem;
  onEdit: () => void;
}) {
  return (
    <header className="bg-background/95 flex min-h-14 shrink-0 items-center gap-3 border-b px-3 backdrop-blur md:px-5">
      <SidebarTrigger className="shrink-0" />
      <div className="bg-muted text-foreground hidden size-8 shrink-0 items-center justify-center rounded-lg sm:flex">
        <Code2 className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-sm font-semibold">{project.name}</h1>
          <Badge
            variant="outline"
            className={
              project.isPublished
                ? "border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700"
                : "text-muted-foreground px-1.5 py-0 text-[10px]"
            }
          >
            {project.isPublished ? "已发布" : "草稿"}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground px-1.5 py-0 text-[10px]">
            {project.projectType === "application" ? "应用" : "对话流"}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hidden size-7 sm:inline-flex"
            onClick={onEdit}
            aria-label="编辑工程信息"
            title="编辑工程信息"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
        <p className="text-muted-foreground hidden text-[11px] sm:block">
          {project.projectType === "application" ? "应用流程与设备运行配置" : "对话流与运行配置"}
        </p>
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="text-muted-foreground hidden items-center gap-1.5 text-[11px] xl:flex">
          <Radio className="size-3.5 text-emerald-600" /> 自动保存
        </div>
      </div>
    </header>
  );
}

export default function ProgrammingWorkspaceLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const projectQuery = useProgrammingProjectQuery(projectId, { refetchOnMount: "always" });
  const project = projectQuery.data;

  if (!projectId) {
    return <div className="flex h-dvh items-center justify-center text-sm">工程地址无效</div>;
  }

  if (projectQuery.isLoading) {
    return (
      <div className="flex h-dvh min-h-0 gap-3 p-3">
        <Skeleton className="hidden h-full w-64 rounded-xl md:block" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="min-h-0 flex-1 rounded-xl" />
        </div>
      </div>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3">
        <Code2 className="text-muted-foreground size-7" />
        <p className="text-sm font-medium">工程加载失败</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/programming")}>
            返回编程
          </Button>
          <Button onClick={() => projectQuery.refetch()}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <ProgrammingProjectContext.Provider value={project}>
      <SidebarProvider storageKey="__programming_workspace_sidebar__" className="h-dvh min-h-0">
        <ProgrammingSidebar project={project} onEdit={() => setEditDialogOpen(true)} />
        <SidebarInset className="h-dvh min-h-0 overflow-hidden rounded-none!">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <WorkspaceTopbar
              project={project}
              onEdit={() => setEditDialogOpen(true)}
            />
            <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <Outlet />
            </main>
          </div>
        </SidebarInset>

        <ProjectNameDialog
          mode="edit"
          open={editDialogOpen}
          initialName={project.name}
          initialDescription={project.description ?? ""}
          isPending={false}
          onOpenChange={setEditDialogOpen}
          onSubmit={() => {}}
        />
      </SidebarProvider>
    </ProgrammingProjectContext.Provider>
  );
}
