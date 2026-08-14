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

export type SimulatorDeviceSnapshot = {
  digitalPins: Record<string, boolean>;
  analogPins: Record<string, number>;
  buttonPressed: boolean;
  potentiometerValue: number;
};

export type SimulatorDeviceOperation = {
  action: string;
  args: Record<string, unknown>;
};

type RuntimeStatus = "loading" | "ready" | "running" | "stopping" | "exited" | "error";

const RUNTIME_FONT_PATH = "/storage/fonts/NotoSansSC-Regular-sub.ttf";
const RUNTIME_FONT_URL = "/esp-claw-runtime/fonts/NotoSansSC-Regular-sub.ttf";
const DEVICE_LOG_PREFIX = "[CubeMax:device]";

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

function executableLua(draft: SimulatorDraft, deviceSnapshot?: SimulatorDeviceSnapshot): string {
  const snapshot = deviceSnapshot ?? {
    digitalPins: {},
    analogPins: {},
    buttonPressed: false,
    potentiometerValue: 0,
  };
  return [
    `local __cubemax_params = ${luaLiteral(draft.params)}`,
    `local __cubemax_device_snapshot = ${luaLiteral(snapshot)}`,
    'local __cubemax_json = require("json")',
    "local function __cubemax_device_operation(action, args)",
    `  print("${DEVICE_LOG_PREFIX}" .. __cubemax_json.encode({ action = action, args = args }))`,
    "end",
    "device = {",
    "  gpio_set_mode = function(pin, mode)",
    '    __cubemax_device_operation("gpio_set_mode", { pin = tostring(pin), mode = mode })',
    "  end,",
    "  gpio_write = function(pin, value)",
    '    __cubemax_device_operation("gpio_write", { pin = tostring(pin), value = value == true })',
    "  end,",
    "  gpio_read = function(pin)",
    "    return __cubemax_device_snapshot.digitalPins[tostring(pin)] == true",
    "  end,",
    "  analog_read = function(pin)",
    "    return __cubemax_device_snapshot.analogPins[tostring(pin)] or 0",
    "  end,",
    "  pwm_write = function(pin, duty_cycle, frequency_hz)",
    '    __cubemax_device_operation("pwm_write", { pin = tostring(pin), dutyCycle = duty_cycle, frequencyHz = frequency_hz or 1000 })',
    "  end,",
    "  servo_write_angle = function(pin, angle)",
    '    __cubemax_device_operation("servo_write_angle", { pin = tostring(pin), angle = angle })',
    "  end,",
    "  serial_write = function(text)",
    '    __cubemax_device_operation("serial_write_text", { text = tostring(text) })',
    "  end,",
    "  button_pressed = function() return __cubemax_device_snapshot.buttonPressed == true end,",
    "  potentiometer_value = function() return __cubemax_device_snapshot.potentiometerValue or 0 end,",
    "}",
    draft.code,
    "",
    'if type(main) == "function" then',
    "  main(__cubemax_params)",
    "end",
  ].join("\n");
}

export function EspClawRuntime({
  draft,
  autoRun = false,
  deviceSnapshot,
  onDeviceOperations,
}: {
  draft?: SimulatorDraft;
  autoRun?: boolean;
  deviceSnapshot?: SimulatorDeviceSnapshot;
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
  const [width, setWidth] = useState("800");
  const [height, setHeight] = useState("480");
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
              setLogs((current) => [...current, "[error] 无法解析虚拟外设操作"]);
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
  }, [flushDeviceOperations, queueDeviceOperation, send]);

  const run = useCallback(async () => {
    if (!activeDraft?.code.trim()) return;
    const moduleId = activeDraft.moduleId || "cubemax-draft";
    const path = `/uploads/cubemax/${moduleId}/scripts/main.lua`;
    setLogs([]);
    pendingRunPathRef.current = path;
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
            { path, text: executableLua(activeDraft, deviceSnapshot) },
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
  }, [activeDraft, deviceSnapshot, send]);

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const applyResolution = () => {
    const nextWidth = Math.max(64, Math.min(2048, Number.parseInt(width, 10) || 800));
    const nextHeight = Math.max(64, Math.min(2048, Number.parseInt(height, 10) || 480));
    setWidth(String(nextWidth));
    setHeight(String(nextHeight));
    send({ type: "esp-claw-sim:setResolution", width: nextWidth, height: nextHeight });
  };

  return (
    <section className="bg-background flex h-[min(620px,calc(100dvh-8.5rem))] min-h-[440px] min-w-0 flex-1 flex-col overflow-hidden rounded-md border shadow-sm">
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
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(260px,1fr)_140px]">
        <div className="grid min-h-0 place-items-center bg-black p-3">
          <iframe
            ref={iframeRef}
            title="ESP-Claw Lua 虚拟屏幕"
            src="/esp-claw-runtime/esp_claw_sim.html?embedded=1"
            className="size-full min-h-0 border-0"
          />
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
