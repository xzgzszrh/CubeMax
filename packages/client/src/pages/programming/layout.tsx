import {
  type LuaPhysicalDeviceItem,
  type ProgrammingProjectItem,
  type ProgrammingRuntimeTarget,
  type SimulatorSession,
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
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@buildingai/ui/components/ui/sidebar";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@buildingai/ui/components/ui/toggle-group";
import { Code2, Cpu, MonitorPlay, Pencil, Radio } from "lucide-react";
import { useState } from "react";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ProgrammingProjectContext } from "./context";
import { ProjectNameDialog } from "./project-name-dialog";
import { ProgrammingSidebar } from "./workspace-sidebar";

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

function WorkspaceTopbar({
  project,
  onEdit,
  onRuntimeChange,
  onSimulatorChange,
  onDeviceChange,
  runtimePending,
  simulatorSessions,
  devices,
}: {
  project: ProgrammingProjectItem;
  onEdit: () => void;
  onRuntimeChange: (target: ProgrammingRuntimeTarget) => void;
  onSimulatorChange: (sessionId: string) => void;
  onDeviceChange: (deviceId: string) => void;
  runtimePending: boolean;
  simulatorSessions: SimulatorSession[];
  devices: LuaPhysicalDeviceItem[];
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
        <span className="text-muted-foreground hidden text-[11px] lg:inline">运行目标</span>
        <ToggleGroup
          type="single"
          value={project.runtimeTarget}
          onValueChange={(value) => value && onRuntimeChange(value as ProgrammingRuntimeTarget)}
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={runtimePending}
        >
          {RUNTIME_ITEMS.map(({ value, label, shortLabel, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
              <Icon /> <span className="hidden md:inline">{shortLabel}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {project.runtimeTarget === "simulator" && (
          <Select value={project.simulatorSessionId ?? ""} onValueChange={onSimulatorChange}>
            <SelectTrigger className="hidden h-8 max-w-44 sm:flex">
              <SelectValue placeholder="选择仿真会话" />
            </SelectTrigger>
            <SelectContent>
              {simulatorSessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {session.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {project.runtimeTarget === "device" && (
          <Select value={project.deviceId ?? ""} onValueChange={onDeviceChange}>
            <SelectTrigger className="hidden h-8 max-w-44 sm:flex">
              <SelectValue placeholder="选择 CubeCat" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.displayName} · {device.online ? "在线" : "离线"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
  const sessionsQuery = useProjectSimulatorSessionsQuery(projectId);
  const devicesQuery = useLuaDevicesQuery();

  const updateMutation = useUpdateProgrammingProjectMutation({
    onSuccess: () => toast.success("工程设置已更新"),
    onError: (error) => toast.error(error.message || "工程设置更新失败"),
  });

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
    updateMutation.mutate({ id: project.id, dto: { runtimeTarget: "device", deviceId } });
  };

  return (
    <ProgrammingProjectContext.Provider value={project}>
      <SidebarProvider storageKey="__programming_workspace_sidebar__" className="h-dvh min-h-0">
        <ProgrammingSidebar project={project} onEdit={() => setEditDialogOpen(true)} />
        <SidebarInset className="h-dvh min-h-0 overflow-hidden rounded-none!">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <WorkspaceTopbar
              project={project}
              onEdit={() => setEditDialogOpen(true)}
              onRuntimeChange={setRuntimeTarget}
              onSimulatorChange={(simulatorSessionId) =>
                updateMutation.mutate({
                  id: project.id,
                  dto: { runtimeTarget: "simulator", simulatorSessionId },
                })
              }
              onDeviceChange={(deviceId) =>
                updateMutation.mutate({
                  id: project.id,
                  dto: { runtimeTarget: "device", deviceId },
                })
              }
              runtimePending={updateMutation.isPending}
              simulatorSessions={sessionsQuery.data ?? []}
              devices={devicesQuery.data ?? []}
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
          isPending={updateMutation.isPending}
          onOpenChange={setEditDialogOpen}
          onSubmit={(dto) =>
            updateMutation.mutate(
              { id: project.id, dto },
              { onSuccess: () => setEditDialogOpen(false) },
            )
          }
        />
      </SidebarProvider>
    </ProgrammingProjectContext.Provider>
  );
}
