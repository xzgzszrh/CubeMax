import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Play, Square, Terminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CLAW4_SCREEN_HEIGHT,
  CLAW4_SCREEN_WIDTH,
  DEVICE_LOG_PREFIX,
  executableClaw4Lua,
  type SimulatorDraft,
} from "./claw4-compat";

export type { SimulatorDraft } from "./claw4-compat";

export type SimulatorDeviceOperation = {
  action: string;
  args: Record<string, unknown>;
};

type RuntimeStatus = "loading" | "ready" | "running" | "stopping" | "exited" | "error";

const RUNTIME_FONT_PATH = "/storage/fonts/NotoSansSC-Regular-sub.ttf";
const RUNTIME_FONT_URL = "/esp-claw-runtime/fonts/NotoSansSC-Regular-sub.ttf";

export function EspClawRuntime({
  draft,
  autoRun = false,
  onDeviceOperations,
}: {
  draft?: SimulatorDraft;
  autoRun?: boolean;
  onDeviceOperations?: (operations: SimulatorDeviceOperation[]) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingRunPathRef = useRef<string | undefined>(undefined);
  const runRef = useRef<() => void>(() => undefined);
  const autoRunRef = useRef(autoRun);
  const onDeviceOperationsRef = useRef(onDeviceOperations);
  const operationQueueRef = useRef<SimulatorDeviceOperation[]>([]);
  const operationTimerRef = useRef<number>();
  const [status, setStatus] = useState<RuntimeStatus>("loading");
  const [logs, setLogs] = useState<string[]>([]);
  const [activeDraft, setActiveDraft] = useState<SimulatorDraft | undefined>(draft);

  useEffect(() => setActiveDraft(draft), [draft]);
  useEffect(() => {
    onDeviceOperationsRef.current = onDeviceOperations;
  }, [onDeviceOperations]);

  const flushDeviceOperations = useCallback(() => {
    if (operationTimerRef.current) window.clearTimeout(operationTimerRef.current);
    operationTimerRef.current = undefined;
    const operations = operationQueueRef.current.splice(0);
    if (operations.length) onDeviceOperationsRef.current?.(operations);
  }, []);

  const queueDeviceOperation = useCallback(
    (operation: SimulatorDeviceOperation) => {
      operationQueueRef.current.push(operation);
      if (!operationTimerRef.current) {
        operationTimerRef.current = window.setTimeout(flushDeviceOperations, 20);
      }
    },
    [flushDeviceOperations],
  );

  useEffect(
    () => () => {
      if (operationTimerRef.current) window.clearTimeout(operationTimerRef.current);
    },
    [],
  );

  const send = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  const applyNativeResolution = useCallback(() => {
    send({
      type: "esp-claw-sim:setResolution",
      width: CLAW4_SCREEN_WIDTH,
      height: CLAW4_SCREEN_HEIGHT,
    });
  }, [send]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as {
        type?: string;
        message?: string;
        error?: string;
        code?: number;
      };
      switch (data.type) {
        case "esp-claw-sim:ready":
          setStatus("ready");
          applyNativeResolution();
          if (autoRunRef.current) {
            autoRunRef.current = false;
            window.setTimeout(() => runRef.current(), 0);
          }
          break;
        case "esp-claw-sim:mounted":
          if (pendingRunPathRef.current) {
            send({ type: "esp-claw-sim:runSkill", path: pendingRunPathRef.current });
            pendingRunPathRef.current = undefined;
          }
          break;
        case "esp-claw-sim:running":
          setStatus("running");
          break;
        case "esp-claw-sim:stopping":
          setStatus("stopping");
          break;
        case "esp-claw-sim:exited":
          flushDeviceOperations();
          setStatus("exited");
          setLogs((current) => [...current, `[sim] exited (${data.code ?? 0})`]);
          break;
        case "esp-claw-sim:log":
          if (data.message?.includes(DEVICE_LOG_PREFIX)) {
            try {
              const json = data.message.slice(
                data.message.indexOf(DEVICE_LOG_PREFIX) + DEVICE_LOG_PREFIX.length,
              );
              const operation = JSON.parse(json) as SimulatorDeviceOperation;
              if (operation.action && operation.args && typeof operation.args === "object") {
                queueDeviceOperation(operation);
              }
            } catch {
              setLogs((current) => [...current, "[error] 无法解析虚拟设备操作"]);
            }
          } else if (
            data.message &&
            !data.message.includes("lv_timer_handler: It seems lv_tick_inc")
          ) {
            setLogs((current) => [...current, data.message!].slice(-300));
          }
          break;
        case "esp-claw-sim:error":
          setStatus("error");
          if (data.error) setLogs((current) => [...current, `[error] ${data.error}`]);
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [applyNativeResolution, flushDeviceOperations, queueDeviceOperation, send]);

  const run = useCallback(async () => {
    if (!activeDraft?.code.trim()) return;
    const moduleId = activeDraft.moduleId || "cubemax-draft";
    const path = `/uploads/cubemax/${moduleId}/scripts/main.lua`;
    setLogs([]);
    pendingRunPathRef.current = path;
    applyNativeResolution();
    try {
      const response = await fetch(RUNTIME_FONT_URL);
      if (!response.ok) throw new Error(`字体资源加载失败（HTTP ${response.status}）`);
      const fontBytes = Array.from(new Uint8Array(await response.arrayBuffer()));
      send({
        type: "esp-claw-sim:mountSkill",
        skill: {
          id: moduleId,
          root: `/uploads/cubemax/${moduleId}`,
          entry: path,
          files: [
            { path, text: executableClaw4Lua(activeDraft) },
            { path: RUNTIME_FONT_PATH, bytes: fontBytes },
          ],
          peripherals: ["display", "touch"],
          capabilityMocks: {},
          simulatorMocks: {},
        },
      });
    } catch (error) {
      pendingRunPathRef.current = undefined;
      setStatus("error");
      setLogs([`[error] ${error instanceof Error ? error.message : "无法加载虚拟屏幕字体"}`]);
    }
  }, [activeDraft, applyNativeResolution, send]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  return (
    <section className="bg-background flex h-[min(720px,calc(100dvh-8.5rem))] min-h-[520px] min-w-0 flex-1 flex-col overflow-hidden rounded-md border shadow-sm">
      <div className="flex min-h-14 flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400" />
          <h2 className="truncate text-sm font-semibold">CubeCat 虚拟屏幕</h2>
          <Badge variant="outline">
            宽 {CLAW4_SCREEN_WIDTH} × 高 {CLAW4_SCREEN_HEIGHT}
          </Badge>
          <Badge variant="outline">
            {status === "loading"
              ? "加载中"
              : status === "running"
                ? "运行中"
                : status === "error"
                  ? "错误"
                  : status === "exited"
                    ? "已结束"
                    : "就绪"}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={run}
            disabled={
              !activeDraft?.code.trim() ||
              status === "loading" ||
              status === "running" ||
              status === "stopping"
            }
          >
            <Play /> 运行 Lua
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="停止仿真"
            onClick={() => send({ type: "esp-claw-sim:stop" })}
            disabled={status !== "running"}
          >
            <Square />
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(320px,1fr)_140px]">
        <div className="grid min-h-0 place-items-center bg-zinc-950 p-3">
          <div
            className="overflow-hidden rounded-[1.4rem] border border-zinc-700 bg-black shadow-lg"
            style={{
              width: "min(100%, 270px)",
              aspectRatio: `${CLAW4_SCREEN_WIDTH} / ${CLAW4_SCREEN_HEIGHT}`,
            }}
          >
            <iframe
              ref={iframeRef}
              title="CubeCat Lua 虚拟屏幕"
              src="/esp-claw-runtime/esp_claw_sim.html?embedded=1"
              className="size-full min-h-0 border-0"
            />
          </div>
        </div>
        <aside className="bg-muted/20 flex min-h-0 flex-col border-t">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3 text-xs font-semibold">
            <Terminal className="size-3.5" />
            运行日志
          </div>
          <ScrollArea className="min-h-0 flex-1" viewportClassName="overflow-y-auto">
            <pre className="text-foreground p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap">
              {logs.length ? logs.join("\n") : "等待运行 Lua 脚本…"}
            </pre>
          </ScrollArea>
        </aside>
      </div>
    </section>
  );
}
