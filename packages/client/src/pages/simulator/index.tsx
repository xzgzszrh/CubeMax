import {
  type SimulatorSession,
  useApplySimulatorOperationsMutation,
  useCreateSimulatorSessionMutation,
  useDeleteSimulatorSessionMutation,
  useLuaModulesQuery,
  useProjectSimulatorSessionsQuery,
  useResetSimulatorSessionMutation,
  useSimulatorSessionQuery,
  useSimulatorSessionsQuery,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import {
  Bell,
  Camera,
  Copy,
  Cpu,
  MessageSquareText,
  Plus,
  RotateCcw,
  SunMedium,
  Trash2,
  Vibrate,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useOptionalProgrammingProject } from "../programming/context";
import {
  GRAPHICS_DEMO_DRAFT,
  GRAPHICS_DEMO_ID,
  type SimulatorDraft,
} from "./claw4-compat";
import { EspClawRuntime } from "./esp-claw-runtime";

const EMPTY_CUBECAT = {
  brightness: 80,
  volume: 70,
  lastVibrateMs: 0,
  lastNotify: "",
  lastSpeech: "",
  lastCameraQuestion: "",
  lastCameraAnswer: "",
  lastAudio: "",
};

function CubeCatStatus({ session }: { session: SimulatorSession }) {
  const cubecat = session.cubecat ?? EMPTY_CUBECAT;
  const rows = [
    {
      icon: SunMedium,
      label: "亮度",
      value: `${cubecat.brightness}%`,
      active: cubecat.brightness > 0,
    },
    {
      icon: Volume2,
      label: "音量",
      value: `${cubecat.volume}%`,
      active: cubecat.volume > 0,
    },
    {
      icon: Vibrate,
      label: "震动",
      value: cubecat.lastVibrateMs > 0 ? `${cubecat.lastVibrateMs} ms` : "无",
      active: cubecat.lastVibrateMs > 0,
    },
    {
      icon: Bell,
      label: "通知",
      value: cubecat.lastNotify || "无",
      active: Boolean(cubecat.lastNotify),
    },
    {
      icon: MessageSquareText,
      label: "语音提示",
      value: cubecat.lastSpeech || "无",
      active: Boolean(cubecat.lastSpeech),
    },
    {
      icon: Camera,
      label: "摄像头",
      value: cubecat.lastCameraAnswer || cubecat.lastCameraQuestion || "未调用",
      active: Boolean(cubecat.lastCameraAnswer || cubecat.lastCameraQuestion),
    },
  ];
  return (
    <div className="divide-y border-y">
      {rows.map(({ icon: Icon, label, value, active }) => (
        <div key={label} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
          <Icon className={`size-4 shrink-0 ${active ? "text-amber-500" : "text-muted-foreground"}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-muted-foreground truncate text-xs">{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function parseParams(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("参数必须是 JSON 对象");
  }
  return parsed as Record<string, unknown>;
}

export default function SimulatorPage({ projectId: projectIdProp }: { projectId?: string } = {}) {
  const project = useOptionalProgrammingProject();
  const projectId = projectIdProp ?? project?.id;
  const sessionsQuery = useSimulatorSessionsQuery({ enabled: !projectId });
  const projectSessionsQuery = useProjectSimulatorSessionsQuery(projectId);
  const sessions = projectId ? (projectSessionsQuery.data ?? []) : (sessionsQuery.data ?? []);
  const modulesQuery = useLuaModulesQuery(projectId ? { projectId } : undefined, {
    enabled: Boolean(projectId),
  });
  const modules = modulesQuery.data?.items ?? [];

  const [selectedId, setSelectedId] = useState<string>();
  const [sourceId, setSourceId] = useState<string>(GRAPHICS_DEMO_ID);
  const [paramsText, setParamsText] = useState(() =>
    JSON.stringify(GRAPHICS_DEMO_DRAFT.params, null, 2),
  );
  const [runtimeResetVersion, setRuntimeResetVersion] = useState(0);
  const didCreateDefault = useRef(false);

  const sessionQuery = useSimulatorSessionQuery(selectedId, { refetchInterval: 1000 });
  const session = sessionQuery.data;

  const createMutation = useCreateSimulatorSessionMutation(
    {
      onSuccess: (created) => {
        setSelectedId(created.id);
        toast.success("CubeCat 仿真会话已创建");
      },
      onError: (error) => toast.error(error.message),
    },
    projectId,
  );
  const resetMutation = useResetSimulatorSessionMutation({
    onSuccess: () => {
      setRuntimeResetVersion((version) => version + 1);
      toast.success("仿真已复位");
    },
    onError: (error) => toast.error(error.message),
  });
  const deviceOperationsMutation = useApplySimulatorOperationsMutation({
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = useDeleteSimulatorSessionMutation({
    onSuccess: () => {
      setSelectedId(undefined);
      toast.success("仿真会话已删除");
    },
    onError: (error) => toast.error(error.message),
  });
  const sessionsLoaded = projectId ? projectSessionsQuery.isSuccess : sessionsQuery.isSuccess;
  const createSession = createMutation.mutate;
  const createPending = createMutation.isPending;

  useEffect(() => {
    if (sessionsLoaded && sessions.length > 0 && !selectedId) {
      setSelectedId(sessions[0].id);
    }
    if (sessionsLoaded && sessions.length === 0 && !didCreateDefault.current && !createPending) {
      didCreateDefault.current = true;
      createSession({ boardType: "cubecat-p4", name: "CubeCat 仿真" });
    }
  }, [
    createPending,
    createSession,
    projectId,
    selectedId,
    sessions.length,
    sessionsLoaded,
  ]);

  const selectedModule = useMemo(
    () => modules.find((item) => item.id === sourceId),
    [modules, sourceId],
  );

  const draft: SimulatorDraft = useMemo(() => {
    if (sourceId === GRAPHICS_DEMO_ID || !selectedModule) {
      let params = GRAPHICS_DEMO_DRAFT.params;
      try {
        params = parseParams(paramsText);
      } catch {
        params = GRAPHICS_DEMO_DRAFT.params;
      }
      return { ...GRAPHICS_DEMO_DRAFT, params };
    }
    let params = selectedModule.testParams ?? {};
    try {
      params = parseParams(paramsText);
    } catch {
      params = selectedModule.testParams ?? {};
    }
    return {
      name: selectedModule.name,
      moduleId: selectedModule.id,
      code: selectedModule.draftCode,
      params,
    };
  }, [paramsText, selectedModule, sourceId]);

  useEffect(() => {
    if (sourceId === GRAPHICS_DEMO_ID) {
      setParamsText(JSON.stringify(GRAPHICS_DEMO_DRAFT.params, null, 2));
      return;
    }
    if (selectedModule) {
      setParamsText(JSON.stringify(selectedModule.testParams ?? {}, null, 2));
    }
  }, [selectedModule, sourceId]);

  return (
    <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex min-h-16 flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <Cpu className="text-primary size-5" />
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-base font-semibold">
            {projectId ? "工程仿真" : "硬件仿真"}
          </h1>
          <p className="text-muted-foreground truncate text-xs">
            对齐 CubeCat 真机 Lua API · 宽 480 × 高 800
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          title="复制会话 ID"
          disabled={!session}
          onClick={() => {
            if (!session) return;
            void navigator.clipboard.writeText(session.id);
            toast.success("会话 ID 已复制");
          }}
        >
          <Copy />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title="复位仿真"
          disabled={!session || resetMutation.isPending}
          onClick={() => session && resetMutation.mutate(session.id)}
        >
          <RotateCcw />
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_360px] xl:overflow-hidden">
        <main className="p-4 xl:min-h-0 xl:overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-[1080px] flex-col gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <div className="text-muted-foreground mb-1 text-xs">运行脚本</div>
                <Select value={sourceId} onValueChange={setSourceId}>
                  <SelectTrigger className="h-9" aria-label="选择 Lua 脚本">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GRAPHICS_DEMO_ID}>内置演示 · 图形</SelectItem>
                    {modules.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{draft.name}</h2>
                <p className="text-muted-foreground text-xs">
                  使用 require("ui") / runtime / device 等真机模块
                </p>
              </div>
            </div>
            <EspClawRuntime
              key={`${selectedId ?? "pending"}-${sourceId}-${runtimeResetVersion}`}
              draft={draft}
              onDeviceOperations={(operations) => {
                if (session && operations.length) {
                  deviceOperationsMutation.mutate({ id: session.id, operations });
                }
              }}
            />
          </div>
        </main>

        <aside className="flex flex-col border-t xl:min-h-0 xl:border-t-0 xl:border-l">
          <div className="border-b">
            <div className="flex items-center gap-2 p-3">
              <Cpu className="size-4 shrink-0" />
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-9 min-w-0 flex-1" aria-label="选择仿真会话">
                  <SelectValue placeholder="选择仿真会话" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                title="新建会话"
                onClick={() =>
                  createMutation.mutate({ boardType: "cubecat-p4", name: "CubeCat 仿真" })
                }
                disabled={createMutation.isPending}
              >
                <Plus />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="删除当前会话"
                className="text-destructive"
                disabled={!session || deleteMutation.isPending}
                onClick={() => session && deleteMutation.mutate(session.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>

          {session ? (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 p-4">
                <section>
                  <div className="mb-2 text-sm font-semibold">main(args)</div>
                  <Textarea
                    value={paramsText}
                    onChange={(event) => setParamsText(event.target.value)}
                    className="min-h-28 font-mono text-xs"
                    aria-label="Lua 参数 JSON"
                  />
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    运行前的 JSON 参数，对应真机 run.args
                  </p>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">CubeCat 状态</h2>
                    <Badge variant="outline">{session.board.name}</Badge>
                  </div>
                  <CubeCatStatus session={session} />
                </section>

                <section className="border-t pt-5">
                  <h2 className="mb-2 text-sm font-semibold">设备日志</h2>
                  <div className="bg-muted/20 max-h-48 overflow-y-auto border">
                    <div className="text-foreground space-y-1 p-3 font-mono text-xs leading-5">
                      {session.serialLog.length === 0 ? (
                        <div className="text-muted-foreground">暂无设备输出</div>
                      ) : (
                        session.serialLog.map((entry) => (
                          <div key={entry.id} className="text-emerald-700">
                            <span className="text-muted-foreground/70 mr-2">#</span>
                            <span className="break-all">{entry.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              正在准备 CubeCat 仿真
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
