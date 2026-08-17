import {
  type ProgrammingRuntimeTarget,
  useLuaDevicesQuery,
  useProgrammingProjectQuery,
  useProjectSimulatorSessionsQuery,
  useUpdateProgrammingProjectMutation,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@buildingai/ui/components/ui/toggle-group";
import {
  ArrowLeft,
  Box,
  Braces,
  Code2,
  Cpu,
  Hammer,
  MonitorPlay,
  Pencil,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ProgrammingProjectContext } from "./context";
import { ProjectNameDialog } from "./project-name-dialog";

const NAV_ITEMS = [
  { path: "program", label: "主流程", icon: Hammer },
  { path: "lua", label: "Lua 模块", icon: Braces },
  { path: "simulator", label: "仿真", icon: MonitorPlay },
  { path: "tools", label: "工具", icon: Wrench },
] as const;

const RUNTIME_ITEMS: Array<{
  value: ProgrammingRuntimeTarget;
  label: string;
  shortLabel: string;
  icon: typeof Code2;
}> = [
  { value: "local", label: "本地运行", shortLabel: "本地", icon: Code2 },
  { value: "simulator", label: "硬件仿真", shortLabel: "仿真", icon: MonitorPlay },
  { value: "device", label: "CubeCat 设备", shortLabel: "设备", icon: Cpu },
];

function WorkspaceNavigation({ projectId }: { projectId: string }) {
  return (
    <>
      <aside className="bg-muted/20 hidden w-48 shrink-0 flex-col border-r md:flex">
        <nav className="flex flex-col gap-1 p-2">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={`/programming/${projectId}/${path}`}
              className={({ isActive }) =>
                `flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-2 ${
                  isActive
                    ? "bg-background text-foreground border shadow-xs"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                }`
              }
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="text-muted-foreground mt-auto border-t px-4 py-3 text-[11px]">
          单一主流程
        </div>
      </aside>
      <nav className="bg-background flex shrink-0 overflow-x-auto border-b md:hidden">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={`/programming/${projectId}/${path}`}
            className={({ isActive }) =>
              `flex h-11 min-w-24 flex-1 items-center justify-center gap-1.5 border-b-2 px-3 text-xs whitespace-nowrap ${
                isActive
                  ? "border-foreground text-foreground"
                  : "text-muted-foreground border-transparent"
              }`
            }
          >
            <Icon className="size-4" /> {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export default function ProgrammingWorkspaceLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const projectQuery = useProgrammingProjectQuery(projectId, { refetchOnMount: "always" });
  const project = projectQuery.data;
  const sessionsQuery = useProjectSimulatorSessionsQuery(projectId);
  const devicesQuery = useLuaDevicesQuery();

  const updateMutation = useUpdateProgrammingProjectMutation({
    onSuccess: () => toast.success("工程设置已更新"),
    onError: (error) => toast.error(error.message || "工程设置更新失败"),
  });

  if (!projectId) {
    return <div className="flex h-full items-center justify-center text-sm">工程地址无效</div>;
  }

  if (projectQuery.isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 p-4">
        <Skeleton className="h-14 w-full" />
        <div className="flex min-h-0 flex-1 gap-3">
          <Skeleton className="hidden h-full w-48 md:block" />
          <Skeleton className="h-full min-w-0 flex-1" />
        </div>
      </div>
    );
  }

  if (projectQuery.isError || !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Box className="text-muted-foreground size-7" />
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

  const setRuntimeTarget = (target: ProgrammingRuntimeTarget) => {
    if (target === project.runtimeTarget) return;
    if (target === "local") {
      updateMutation.mutate({ id: project.id, dto: { runtimeTarget: "local" } });
      return;
    }
    if (target === "simulator") {
      const sessionId = project.simulatorSessionId ?? sessionsQuery.data?.find(Boolean)?.id ?? null;
      if (!sessionId) {
        toast.error("请先创建一个工程仿真会话");
        navigate(`/programming/${project.id}/simulator`);
        return;
      }
      updateMutation.mutate({
        id: project.id,
        dto: { runtimeTarget: "simulator", simulatorSessionId: sessionId },
      });
      return;
    }

    const deviceId =
      project.deviceId ?? devicesQuery.data?.find((device) => device.online)?.deviceId;
    if (!deviceId) {
      toast.error("没有可用的 CubeCat 设备");
      return;
    }
    updateMutation.mutate({
      id: project.id,
      dto: { runtimeTarget: "device", deviceId },
    });
  };

  return (
    <ProgrammingProjectContext.Provider value={project}>
      <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 md:px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate("/programming")}
            aria-label="返回工程列表"
            title="返回工程列表"
          >
            <ArrowLeft />
          </Button>
          <span className="bg-foreground text-background flex size-8 shrink-0 items-center justify-center rounded-md">
            <Code2 className="size-4" />
          </span>
          <button
            type="button"
            className="hover:bg-muted flex max-w-64 min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-left"
            onClick={() => setEditDialogOpen(true)}
            title="编辑工程信息"
          >
            <span className="truncate text-sm font-semibold">{project.name}</span>
            <Pencil className="text-muted-foreground size-3.5 shrink-0" />
          </button>
          <Badge
            variant="outline"
            className={
              project.isPublished
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "text-muted-foreground"
            }
          >
            {project.isPublished ? "已发布" : "草稿"}
          </Badge>

          <div className="ml-auto flex min-w-0 items-center gap-2 max-lg:order-3 max-lg:w-full">
            <span className="text-muted-foreground hidden shrink-0 text-xs sm:inline">
              运行目标
            </span>
            <ToggleGroup
              type="single"
              value={project.runtimeTarget}
              onValueChange={(value) =>
                value && setRuntimeTarget(value as ProgrammingRuntimeTarget)
              }
              variant="outline"
              size="sm"
              className="min-w-0"
              disabled={updateMutation.isPending}
            >
              {RUNTIME_ITEMS.map(({ value, label, shortLabel, icon: Icon }) => (
                <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
                  <Icon /> <span className="hidden sm:inline">{shortLabel}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {project.runtimeTarget === "simulator" && (
              <Select
                value={project.simulatorSessionId ?? ""}
                onValueChange={(simulatorSessionId) =>
                  updateMutation.mutate({
                    id: project.id,
                    dto: { runtimeTarget: "simulator", simulatorSessionId },
                  })
                }
              >
                <SelectTrigger className="h-8 min-w-0 flex-1 sm:w-48 sm:flex-none">
                  <SelectValue placeholder="选择仿真会话" />
                </SelectTrigger>
                <SelectContent>
                  {(sessionsQuery.data ?? []).map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {project.runtimeTarget === "device" && (
              <Select
                value={project.deviceId ?? ""}
                onValueChange={(deviceId) =>
                  updateMutation.mutate({
                    id: project.id,
                    dto: { runtimeTarget: "device", deviceId },
                  })
                }
              >
                <SelectTrigger className="h-8 min-w-0 flex-1 sm:w-48 sm:flex-none">
                  <SelectValue placeholder="选择 CubeCat" />
                </SelectTrigger>
                <SelectContent>
                  {(devicesQuery.data ?? []).map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.displayName} · {device.online ? "在线" : "离线"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <WorkspaceNavigation projectId={project.id} />
          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <Outlet />
          </main>
        </div>

        <ProjectNameDialog
          mode="edit"
          open={editDialogOpen}
          initialName={project.name}
          initialDescription={project.description ?? ""}
          isPending={updateMutation.isPending}
          onOpenChange={setEditDialogOpen}
          onSubmit={(dto) =>
            updateMutation.mutate(
              { id: project.id, dto },
              { onSuccess: () => setEditDialogOpen(false) },
            )
          }
        />
      </div>
    </ProgrammingProjectContext.Provider>
  );
}
