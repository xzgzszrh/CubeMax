import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Play, RotateCcw, Square, Terminal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type SimulatorDraft = {
  name: string;
  moduleId?: string;
  code: string;
  params: Record<string, unknown>;
};

type RuntimeStatus = "loading" | "ready" | "running" | "stopping" | "exited" | "error";

function luaLiteral(value: unknown): string {
  if (value === null || value === undefined) return "nil";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const encoded = Array.from(value, (character) => {
      if (character === "\\") return "\\\\";
      if (character === '"') return '\\"';
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 ? `\\${codePoint.toString().padStart(3, "0")}` : character;
    }).join("");
    return `"${encoded}"`;
  }
  if (Array.isArray(value)) return `{${value.map(luaLiteral).join(",")}}`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `[${luaLiteral(key)}]=${luaLiteral(item)}`)
      .join(",")}}`;
  }
  return "nil";
}

function executableLua(draft: SimulatorDraft): string {
  return [
    `local __cubemax_params = ${luaLiteral(draft.params)}`,
    draft.code,
    "",
    'if type(main) == "function" then',
    "  local __cubemax_result = main(__cubemax_params)",
    "  if __cubemax_result ~= nil then",
    '    print("[CubeMax] result: " .. tostring(__cubemax_result))',
    "  end",
    "end",
  ].join("\n");
}

export function EspClawRuntime({ draft }: { draft?: SimulatorDraft }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingRunPathRef = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState<RuntimeStatus>("loading");
  const [logs, setLogs] = useState<string[]>([]);
  const [width, setWidth] = useState("800");
  const [height, setHeight] = useState("480");
  const [activeDraft, setActiveDraft] = useState<SimulatorDraft | undefined>(draft);

  useEffect(() => setActiveDraft(draft), [draft]);

  const send = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as {
        type?: string;
        message?: string;
        error?: string;
        code?: number;
        width?: number;
        height?: number;
      };
      switch (data.type) {
        case "esp-claw-sim:ready":
          setStatus("ready");
          if (data.width) setWidth(String(data.width));
          if (data.height) setHeight(String(data.height));
          break;
        case "esp-claw-sim:mounted":
          if (pendingRunPathRef.current) {
            send({ type: "esp-claw-sim:runSkill", path: pendingRunPathRef.current });
            pendingRunPathRef.current = undefined;
          }
          break;
        case "esp-claw-sim:running":
          setStatus("running");
          setLogs((current) => [...current, `[sim] running ${data.message ?? ""}`]);
          break;
        case "esp-claw-sim:stopping":
          setStatus("stopping");
          break;
        case "esp-claw-sim:exited":
          setStatus("exited");
          setLogs((current) => [...current, `[sim] exited (${data.code ?? 0})`]);
          break;
        case "esp-claw-sim:log":
          if (data.message) setLogs((current) => [...current, data.message!].slice(-300));
          break;
        case "esp-claw-sim:error":
          setStatus("error");
          if (data.error) setLogs((current) => [...current, `[error] ${data.error}`]);
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [send]);

  const run = () => {
    if (!activeDraft?.code.trim()) return;
    const moduleId = activeDraft.moduleId || "cubemax-draft";
    const path = `/uploads/cubemax/${moduleId}/scripts/main.lua`;
    setLogs([]);
    pendingRunPathRef.current = path;
    send({
      type: "esp-claw-sim:mountSkill",
      skill: {
        id: moduleId,
        root: `/uploads/cubemax/${moduleId}`,
        entry: path,
        files: [{ path, text: executableLua(activeDraft) }],
        peripherals: ["display", "touch"],
        capabilityMocks: {},
        simulatorMocks: {},
      },
    });
  };

  const applyResolution = () => {
    const nextWidth = Math.max(64, Math.min(2048, Number.parseInt(width, 10) || 800));
    const nextHeight = Math.max(64, Math.min(2048, Number.parseInt(height, 10) || 480));
    setWidth(String(nextWidth));
    setHeight(String(nextHeight));
    send({ type: "esp-claw-sim:setResolution", width: nextWidth, height: nextHeight });
  };

  return (
    <section className="bg-background flex min-h-[520px] min-w-0 flex-1 flex-col overflow-hidden rounded-md border shadow-sm">
      <div className="flex min-h-14 flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400" />
          <h2 className="truncate text-sm font-semibold">ESP-Claw 虚拟屏幕</h2>
          <Badge variant="outline">
            {status === "loading"
              ? "加载中"
              : status === "running"
                ? "运行中"
                : status === "error"
                  ? "错误"
                  : "就绪"}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            value={width}
            onChange={(event) => setWidth(event.target.value)}
            className="h-8 w-16 text-xs"
            aria-label="屏幕宽度"
          />
          <span className="text-muted-foreground">x</span>
          <Input
            value={height}
            onChange={(event) => setHeight(event.target.value)}
            className="h-8 w-16 text-xs"
            aria-label="屏幕高度"
          />
          <Button variant="ghost" size="icon-sm" title="应用分辨率" onClick={applyResolution}>
            <RotateCcw />
          </Button>
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
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid min-h-[360px] place-items-center bg-black p-3">
          <iframe
            ref={iframeRef}
            title="ESP-Claw Lua 虚拟屏幕"
            src="/esp-claw-runtime/esp_claw_sim.html?embedded=1"
            className="h-full min-h-[360px] w-full border-0"
          />
        </div>
        <aside className="bg-muted/20 flex min-h-0 flex-col border-t lg:border-t-0 lg:border-l">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3 text-xs font-semibold">
            <Terminal className="size-3.5" />
            运行日志
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <pre className="text-foreground p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap">
              {logs.length ? logs.join("\n") : "等待运行 Lua 脚本…"}
            </pre>
          </ScrollArea>
        </aside>
      </div>
    </section>
  );
}
