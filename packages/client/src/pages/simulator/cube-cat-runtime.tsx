import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Play, Square, Terminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CLAW4_SCREEN_HEIGHT,
  CLAW4_SCREEN_WIDTH,
  type SimulatorDraft,
} from "./claw4-compat";
import { DisplayHost } from "./display-host";
import { runBrowserLua, type SimDeviceOperation } from "./lua-browser-engine";

export type { SimulatorDraft } from "./claw4-compat";
export type SimulatorDeviceOperation = SimDeviceOperation;

type RuntimeStatus = "ready" | "running" | "stopping" | "exited" | "error";

export function CubeCatRuntime({
  draft,
  onDeviceOperations,
}: {
  draft?: SimulatorDraft;
  onDeviceOperations?: (operations: SimulatorDeviceOperation[]) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<DisplayHost | null>(null);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  const onDeviceOperationsRef = useRef(onDeviceOperations);
  const [status, setStatus] = useState<RuntimeStatus>("ready");
  const [logs, setLogs] = useState<string[]>([]);
  const [scale, setScale] = useState(0.56);

  useEffect(() => {
    onDeviceOperationsRef.current = onDeviceOperations;
  }, [onDeviceOperations]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => {
      setScale(frame.clientWidth / CLAW4_SCREEN_WIDTH);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const appendLog = useCallback((line: string) => {
    setLogs((current) => [...current, line].slice(-300));
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    hostRef.current?.cancelPolls();
    setStatus((current) => (current === "running" ? "stopping" : current));
  }, []);

  const run = useCallback(async () => {
    if (!draft?.code.trim() || runningRef.current) return;
    const stage = stageRef.current;
    if (!stage) return;
    cancelledRef.current = false;
    runningRef.current = true;
    setLogs([]);
    setStatus("running");
    const host = new DisplayHost(stage);
    hostRef.current = host;
    try {
      await runBrowserLua({
        code: draft.code,
        params: draft.params ?? {},
        host,
        cancelled: () => cancelledRef.current,
        onLog: appendLog,
        onOperation: (operation) => onDeviceOperationsRef.current?.([operation]),
      });
      setStatus("exited");
      appendLog(cancelledRef.current ? "[sim] stopped" : "[sim] exited (0)");
    } catch (error) {
      setStatus("error");
      appendLog(`[error] ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      runningRef.current = false;
      if (cancelledRef.current) setStatus("exited");
    }
  }, [appendLog, draft]);

  useEffect(() => () => {
    cancelledRef.current = true;
  }, []);

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
            {status === "running"
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
            onClick={() => void run()}
            disabled={!draft?.code.trim() || status === "running" || status === "stopping"}
          >
            <Play /> 运行 Lua
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="停止仿真"
            onClick={stop}
            disabled={status !== "running"}
          >
            <Square />
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(320px,1fr)_140px]">
        <div className="grid min-h-0 place-items-center bg-zinc-950 p-3">
          <div
            ref={frameRef}
            className="overflow-hidden rounded-[1.4rem] border border-zinc-700 bg-black shadow-lg"
            style={{
              width: "min(100%, 270px)",
              aspectRatio: `${CLAW4_SCREEN_WIDTH} / ${CLAW4_SCREEN_HEIGHT}`,
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <div ref={stageRef} />
            </div>
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
