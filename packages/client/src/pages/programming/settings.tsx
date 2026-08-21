import {
  type ProgrammingProjectItem,
  type ProgrammingRuntimeTarget,
  useLuaDevicesQuery,
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
import { Separator } from "@buildingai/ui/components/ui/separator";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@buildingai/ui/components/ui/toggle-group";
import { Cpu, MonitorPlay, Settings as SettingsIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useProgrammingProject } from "./context";

const RUNTIME_ITEMS: Array<{
  value: ProgrammingRuntimeTarget;
  label: string;
  icon: typeof MonitorPlay;
}> = [
  { value: "local", label: "本地运行", icon: SettingsIcon },
  { value: "simulator", label: "硬件仿真", icon: MonitorPlay },
  { value: "device", label: "CubeCat 设备", icon: Cpu },
];

export default function ProjectSettingsPage() {
  const project = useProgrammingProject();
  const navigate = useNavigate();
  const sessionsQuery = useProjectSimulatorSessionsQuery(project.id);
  const devicesQuery = useLuaDevicesQuery();

  const updateMutation = useUpdateProgrammingProjectMutation({
    onSuccess: () => toast.success("设置已保存"),
    onError: (error) => toast.error(error.message || "设置保存失败"),
  });

  const handleRuntimeChange = (target: ProgrammingRuntimeTarget) => {
    if (target === project.runtimeTarget) return;

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

    if (target === "device") {
      const deviceId = project.deviceId ?? devicesQuery.data?.find((d) => d.online)?.deviceId;
      if (!deviceId) {
        toast.error("没有可用的 CubeCat 设备");
        return;
      }
      updateMutation.mutate({ id: project.id, dto: { runtimeTarget: "device", deviceId } });
      return;
    }

    updateMutation.mutate({ id: project.id, dto: { runtimeTarget: "local" } });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 overflow-y-auto p-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">工程设置</h1>
        <p className="text-muted-foreground text-sm">配置工程运行的目标设备和运行环境</p>
      </div>

      <Separator />

      {/* 运行目标 */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">运行目标</h2>
          <p className="text-muted-foreground text-xs">
            选择工程发布后的运行环境。本地运行仅用于开发调试。
          </p>
        </div>

        <ToggleGroup
          type="single"
          value={project.runtimeTarget}
          onValueChange={(value) => value && handleRuntimeChange(value as ProgrammingRuntimeTarget)}
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled={updateMutation.isPending}
        >
          {RUNTIME_ITEMS.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label} className="flex-1">
              <Icon className="mr-1.5 size-4" />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      {/* 仿真会话选择 */}
      {project.runtimeTarget === "simulator" && (
        <section className="space-y-4">
          <Separator />
          <div className="space-y-1">
            <h2 className="text-sm font-medium">仿真会话</h2>
            <p className="text-muted-foreground text-xs">
              选择用于仿真的硬件会话。需要在仿真页面创建会话后才能选择。
            </p>
          </div>

          {sessionsQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
            <Select
              value={project.simulatorSessionId ?? ""}
              onValueChange={(sessionId) =>
                updateMutation.mutate({
                  id: project.id,
                  dto: { runtimeTarget: "simulator", simulatorSessionId: sessionId },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择仿真会话" />
              </SelectTrigger>
              <SelectContent>
                {sessionsQuery.data.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.name}
                    {session.id === project.simulatorSessionId ? "（当前）" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">还没有仿真会话</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/programming/${project.id}/simulator`)}
              >
                去创建仿真会话
              </Button>
            </div>
          )}
        </section>
      )}

      {/* 设备选择 */}
      {project.runtimeTarget === "device" && (
        <section className="space-y-4">
          <Separator />
          <div className="space-y-1">
            <h2 className="text-sm font-medium">目标设备</h2>
            <p className="text-muted-foreground text-xs">
              选择运行工程的目标 CubeCat 设备。设备需要在线才能接收任务。
            </p>
          </div>

          {devicesQuery.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : devicesQuery.data && devicesQuery.data.length > 0 ? (
            <Select
              value={project.deviceId ?? ""}
              onValueChange={(deviceId) =>
                updateMutation.mutate({
                  id: project.id,
                  dto: { runtimeTarget: "device", deviceId },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择目标设备" />
              </SelectTrigger>
              <SelectContent>
                {devicesQuery.data.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    <span className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          device.online
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "text-muted-foreground"
                        }
                      >
                        {device.online ? "在线" : "离线"}
                      </Badge>
                      {device.displayName}
                      <span className="text-muted-foreground text-xs">· {device.deviceType}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-muted-foreground text-sm">没有可用的 CubeCat 设备</p>
          )}
        </section>
      )}

      {/* 工程信息 */}
      <Separator />
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">工程信息</h2>
          <p className="text-muted-foreground text-xs">工程的元数据和发布状态</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
          <div>
            <p className="text-muted-foreground text-xs">工程名称</p>
            <p className="text-sm font-medium">{project.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">工程类型</p>
            <p className="text-sm">{project.projectType === "application" ? "应用" : "对话流"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">发布状态</p>
            <Badge
              variant="outline"
              className={
                project.isPublished
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "text-muted-foreground"
              }
            >
              {project.isPublished ? "已发布" : "草稿"}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Lua 模块</p>
            <p className="text-sm">{project.luaModuleCount} 个</p>
          </div>
        </div>
      </section>
    </div>
  );
}
