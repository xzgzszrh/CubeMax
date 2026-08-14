import {
  type SimulatorSession,
  useApplySimulatorOperationsMutation,
  useCreateSimulatorSessionMutation,
  useDeleteSimulatorSessionMutation,
  useLuaModulesQuery,
  useResetSimulatorSessionMutation,
  useSimulatorSessionQuery,
  useSimulatorSessionsQuery,
  useUpdateSimulatorInputMutation,
  useWriteSimulatorSerialMutation,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Slider } from "@buildingai/ui/components/ui/slider";
import {
  Activity,
  Box,
  CircleGauge,
  Copy,
  Cpu,
  FileCode2,
  FileUp,
  Lightbulb,
  Plus,
  RotateCcw,
  Send,
  Terminal,
  Trash2,
  Volume2,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EspClawRuntime, type SimulatorDraft } from "./esp-claw-runtime";

const SIMULATOR_DRAFT_KEY = "cubemax:simulator-draft";
const EXAMPLE_LUA_SOURCE = "example";
const TRANSFERRED_DRAFT_SOURCE = "transferred-draft";
const LOCAL_FILE_SOURCE = "local-file";

const DEFAULT_DISPLAY_DRAFT: SimulatorDraft = {
  name: "虚拟屏幕示例",
  code: `local board_manager = require("board_manager")
local lvgl = require("lvgl")

function main(params)
  local panel, io, width, height, panel_if =
    board_manager.get_display_lcd_params("display_lcd")

  lvgl.init(panel, io, width, height, panel_if, {
    buffer_lines = 10,
    tick_ms = 5,
    task_period_ms = 10,
    font_path = "fonts/NotoSansSC-Regular-sub.ttf",
    font_size = 24,
  })

  local screen = lvgl.create_screen()
  screen:set_style({ bg_color = "#f8fafc" })
  lvgl.label(screen, {
    text = params.message or "你好，CubeMax！",
    align = "center",
    text_color = "#0f172a",
  })
  device.gpio_write(2, true)
  device.serial_write("屏幕和板载 LED 已由同一段 Lua 启动")
  screen:load()
  lvgl.run({ period_ms = 50 })
end`,
  params: { message: "你好，CubeMax！" },
};

function DevBoard({ session }: { session: SimulatorSession }) {
  const { led, button } = session.peripherals;
  const activePinCount = Object.values(session.pins).filter(
    (pin) => pin.digitalValue || pin.pwmDutyCycle > 0,
  ).length;
  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="relative aspect-[16/9] overflow-hidden rounded-md border border-emerald-950 bg-emerald-700 shadow-sm">
        <div className="absolute inset-y-3 left-2 flex flex-col justify-between">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className="size-1.5 rounded-sm bg-zinc-300" />
          ))}
        </div>
        <div className="absolute inset-y-3 right-2 flex flex-col justify-between">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className="size-1.5 rounded-sm bg-zinc-300" />
          ))}
        </div>

        <div className="absolute top-0 left-1/2 h-8 w-16 -translate-x-1/2 rounded-b-sm border-x border-b border-zinc-400 bg-zinc-200">
          <div className="mx-auto mt-2 h-3 w-10 rounded-sm bg-zinc-400" />
        </div>

        <div className="absolute top-1/2 left-1/2 flex h-[45%] w-[58%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm border border-zinc-500 bg-zinc-800 shadow-sm">
          <div className="text-center text-zinc-200">
            <Cpu className="mx-auto mb-1 size-5" />
            <div className="text-xs font-semibold">ESP-WROOM-32</div>
          </div>
        </div>

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-8">
          <div className="flex items-center gap-1.5 text-[9px] text-emerald-50">
            <span
              className={`size-2.5 rounded-full border ${led.on ? "border-amber-200 bg-amber-400 shadow-[0_0_10px_#fbbf24]" : "border-zinc-400 bg-zinc-700"}`}
            />
            LED
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-emerald-50">
            <span
              className={`size-3 rounded-sm border ${button.pressed ? "border-zinc-200 bg-zinc-800" : "border-zinc-300 bg-zinc-600"}`}
            />
            BOOT
          </div>
        </div>
      </div>
      <div className="text-muted-foreground mt-2 flex items-center justify-between text-[11px]">
        <span>{session.board.name}</span>
        <span>{activePinCount} 个活动引脚</span>
      </div>
    </div>
  );
}

function PeripheralStatus({ session }: { session: SimulatorSession }) {
  const { led, button, potentiometer, buzzer, servo } = session.peripherals;
  const rows = [
    {
      icon: Lightbulb,
      label: "LED",
      pin: led.pin,
      value: led.on ? "点亮" : "熄灭",
      active: led.on,
    },
    {
      icon: Activity,
      label: "按键",
      pin: button.pin,
      value: button.pressed ? "按下" : "松开",
      active: button.pressed,
    },
    {
      icon: CircleGauge,
      label: "电位器",
      pin: potentiometer.pin,
      value: `${potentiometer.value} / ${potentiometer.max}`,
    },
    {
      icon: Volume2,
      label: "蜂鸣器",
      pin: buzzer.pin,
      value: buzzer.active ? `${buzzer.frequencyHz} Hz` : "静音",
      active: buzzer.active,
    },
    { icon: Box, label: "舵机", pin: servo.pin, value: `${servo.angle}°` },
  ];
  return (
    <div className="divide-y border-y">
      {rows.map(({ icon: Icon, label, pin, value, active }) => (
        <div key={label} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
          <Icon className={`size-4 ${active ? "text-amber-500" : "text-muted-foreground"}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-muted-foreground text-xs">GPIO {pin}</div>
          </div>
          <span className="text-xs tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function SimulatorPage() {
  const sessionsQuery = useSimulatorSessionsQuery();
  const luaModulesQuery = useLuaModulesQuery();
  const sessions = sessionsQuery.data ?? [];
  const luaModules = luaModulesQuery.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const [potentiometer, setPotentiometer] = useState(2048);
  const [serialInput, setSerialInput] = useState("");
  const [simulatorDraft, setSimulatorDraft] = useState<SimulatorDraft>(DEFAULT_DISPLAY_DRAFT);
  const [luaSource, setLuaSource] = useState(EXAMPLE_LUA_SOURCE);
  const [localFileName, setLocalFileName] = useState<string>();
  const [runtimeResetVersion, setRuntimeResetVersion] = useState(0);
  const didCreateDefault = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionQuery = useSimulatorSessionQuery(selectedId, { refetchInterval: 1000 });
  const session = sessionQuery.data;

  const createMutation = useCreateSimulatorSessionMutation({
    onSuccess: (created) => {
      setSelectedId(created.id);
      toast.success("虚拟开发板已创建");
    },
    onError: (error) => toast.error(error.message),
  });
  const resetMutation = useResetSimulatorSessionMutation({
    onSuccess: () => {
      setRuntimeResetVersion((version) => version + 1);
      toast.success("开发板已复位");
    },
    onError: (error) => toast.error(error.message),
  });
  const inputMutation = useUpdateSimulatorInputMutation({
    onError: (error) => toast.error(error.message),
  });
  const deviceOperationsMutation = useApplySimulatorOperationsMutation({
    onError: (error) => toast.error(error.message),
  });
  const serialMutation = useWriteSimulatorSerialMutation({
    onSuccess: () => setSerialInput(""),
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = useDeleteSimulatorSessionMutation({
    onSuccess: () => {
      setSelectedId(undefined);
      toast.success("仿真会话已删除");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SIMULATOR_DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SimulatorDraft;
        if (parsed.code && parsed.name) {
          setSimulatorDraft(parsed);
          setLuaSource(TRANSFERRED_DRAFT_SOURCE);
        }
      }
    } catch {
      toast.error("无法读取 Lua 仿真草稿");
    }
  }, []);

  useEffect(() => {
    if (sessionsQuery.isSuccess && sessions.length > 0 && !selectedId) {
      setSelectedId(sessions[0].id);
    }
    if (
      sessionsQuery.isSuccess &&
      sessions.length === 0 &&
      !didCreateDefault.current &&
      !createMutation.isPending
    ) {
      didCreateDefault.current = true;
      createMutation.mutate(undefined);
    }
  }, [createMutation, selectedId, sessions, sessionsQuery.isSuccess]);

  useEffect(() => {
    if (session) setPotentiometer(session.peripherals.potentiometer.value);
  }, [session]);

  const activePins = useMemo(
    () =>
      Object.entries(session?.pins ?? {}).sort(([a], [b]) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [session?.pins],
  );

  const deviceSnapshot = useMemo(() => {
    const digitalPins = Object.fromEntries(
      Object.entries(session?.pins ?? {}).map(([pin, state]) => [pin, state.digitalValue]),
    );
    const analogPins = Object.fromEntries(
      Object.entries(session?.pins ?? {}).map(([pin, state]) => [pin, state.analogValue]),
    );
    if (session) {
      digitalPins[session.peripherals.button.pin] = session.peripherals.button.pressed;
      analogPins[session.peripherals.potentiometer.pin] = session.peripherals.potentiometer.value;
    }
    return {
      digitalPins,
      analogPins,
      buttonPressed: session?.peripherals.button.pressed ?? false,
      potentiometerValue: session?.peripherals.potentiometer.value ?? 0,
    };
  }, [session]);

  const sendSerial = () => {
    const text = serialInput.trim();
    if (session && text) serialMutation.mutate({ id: session.id, text });
  };

  const selectLuaSource = (value: string) => {
    if (value === EXAMPLE_LUA_SOURCE) {
      setSimulatorDraft({ ...DEFAULT_DISPLAY_DRAFT, params: { ...DEFAULT_DISPLAY_DRAFT.params } });
      setLocalFileName(undefined);
      setLuaSource(value);
      return;
    }

    if (value === TRANSFERRED_DRAFT_SOURCE || value === LOCAL_FILE_SOURCE) return;

    const module = luaModules.find((item) => `module:${item.id}` === value);
    if (!module) return;
    setSimulatorDraft({
      name: module.name,
      moduleId: module.id,
      code: module.draftCode,
      params: {},
    });
    setLocalFileName(undefined);
    setLuaSource(value);
  };

  const loadLocalLuaFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const code = await file.text();
      if (!code.trim()) {
        toast.error("Lua 文件为空");
        return;
      }
      const fileName = file.name.replace(/\.lua$/i, "") || "本地 Lua 文件";
      const safeModuleId = `local-${
        fileName
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "") || "script"
      }`;
      setSimulatorDraft({ name: fileName, moduleId: safeModuleId, code, params: {} });
      setLocalFileName(file.name);
      setLuaSource(LOCAL_FILE_SOURCE);
      toast.success(`已选择 ${file.name}`);
    } catch {
      toast.error("无法读取 Lua 文件");
    }
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex min-h-16 flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <Cpu className="text-primary size-5" />
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-base font-semibold">硬件仿真</h1>
          <p className="text-muted-foreground truncate text-xs">Lua + LVGL 应用层仿真</p>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 max-md:order-3 max-md:w-full">
          <FileCode2 className="text-muted-foreground size-4 shrink-0" />
          <Select value={luaSource} onValueChange={selectLuaSource}>
            <SelectTrigger
              className="h-9 w-[min(300px,calc(100vw-10rem))] min-w-0"
              aria-label="选择 Lua 文件"
            >
              <SelectValue placeholder="选择 Lua 文件" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EXAMPLE_LUA_SOURCE}>虚拟屏幕示例</SelectItem>
              {luaSource === TRANSFERRED_DRAFT_SOURCE && (
                <SelectItem value={TRANSFERRED_DRAFT_SOURCE}>
                  {simulatorDraft.name}（创作页草稿）
                </SelectItem>
              )}
              {luaSource === LOCAL_FILE_SOURCE && localFileName && (
                <SelectItem value={LOCAL_FILE_SOURCE}>{localFileName}（本地文件）</SelectItem>
              )}
              {luaModules.length > 0 && (
                <>
                  {luaModules.map((module) => (
                    <SelectItem key={module.id} value={`module:${module.id}`}>
                      {module.name}
                      {module.isPublished ? "" : "（草稿）"}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".lua,text/x-lua,text/plain"
            className="hidden"
            onChange={loadLocalLuaFile}
          />
          <Button
            variant="outline"
            size="icon"
            title="导入本地 Lua 文件"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp />
          </Button>
        </div>
        <Button
          variant="outline"
          size="icon"
          title="复制会话 ID"
          disabled={!session}
          onClick={() => {
            if (!session) return;
            void navigator.clipboard.writeText(session.id);
            toast.success("会话 ID 已复制，可粘贴到工作流节点");
          }}
        >
          <Copy />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title="复位开发板"
          disabled={!session || resetMutation.isPending}
          onClick={() => session && resetMutation.mutate(session.id)}
        >
          <RotateCcw />
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_380px] xl:overflow-hidden">
        <main className="min-h-0 p-4 xl:overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-[1080px] flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">{simulatorDraft.name}</h2>
              <p className="text-muted-foreground text-xs">
                屏幕、按键和外设使用同一个虚拟 ESP32 会话。
              </p>
            </div>
            <EspClawRuntime
              key={`${selectedId ?? "pending"}-${runtimeResetVersion}`}
              draft={simulatorDraft}
              deviceSnapshot={deviceSnapshot}
              onDeviceOperations={(operations) => {
                if (session && operations.length) {
                  deviceOperationsMutation.mutate({ id: session.id, operations });
                }
              }}
            />
          </div>
        </main>

        <aside className="flex min-h-0 flex-col border-t xl:border-t-0 xl:border-l">
          <div className="flex items-center gap-2 border-b p-3">
            <Cpu className="size-4 shrink-0" />
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-9 min-w-0 flex-1" aria-label="选择虚拟开发板">
                <SelectValue placeholder="选择虚拟开发板" />
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
              title="新建开发板"
              onClick={() => createMutation.mutate(undefined)}
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

          {session ? (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 p-4">
                <DevBoard session={session} />
                <section className="grid gap-5 border-t pt-5 sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold">板载按键</h2>
                        <p className="text-muted-foreground text-xs">
                          GPIO {session.peripherals.button.pin}
                        </p>
                      </div>
                      <Badge variant={session.peripherals.button.pressed ? "default" : "outline"}>
                        {session.peripherals.button.pressed ? "已按下" : "松开"}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      className="h-11 w-full"
                      onPointerDown={() =>
                        inputMutation.mutate({
                          id: session.id,
                          input: { type: "button", pressed: true },
                        })
                      }
                      onPointerUp={() =>
                        inputMutation.mutate({
                          id: session.id,
                          input: { type: "button", pressed: false },
                        })
                      }
                      onPointerLeave={() =>
                        inputMutation.mutate({
                          id: session.id,
                          input: { type: "button", pressed: false },
                        })
                      }
                      onPointerCancel={() =>
                        inputMutation.mutate({
                          id: session.id,
                          input: { type: "button", pressed: false },
                        })
                      }
                    >
                      按住 BOOT
                    </Button>
                  </div>
                  <div>
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold">电位器</h2>
                        <p className="text-muted-foreground text-xs">
                          ADC · GPIO {session.peripherals.potentiometer.pin}
                        </p>
                      </div>
                      <span className="font-mono text-sm tabular-nums">{potentiometer}</span>
                    </div>
                    <Slider
                      min={0}
                      max={4095}
                      step={1}
                      value={[potentiometer]}
                      onValueChange={([value]) => setPotentiometer(value)}
                      onValueCommit={([value]) =>
                        inputMutation.mutate({
                          id: session.id,
                          input: { type: "potentiometer", value },
                        })
                      }
                    />
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <Activity className="size-4" />
                    <h2 className="text-sm font-semibold">器件状态</h2>
                  </div>
                  <PeripheralStatus session={session} />
                </section>

                {activePins.length > 0 && (
                  <section>
                    <div className="mb-2 text-xs font-medium">活动引脚</div>
                    <div className="flex flex-wrap gap-1.5">
                      {activePins.map(([pin, state]) => (
                        <Badge key={pin} variant="outline" className="font-mono text-[10px]">
                          {pin} · {state.mode} · {state.digitalValue ? "HIGH" : "LOW"}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                <section className="border-t pt-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Terminal className="size-4" />
                    <h2 className="text-sm font-semibold">串口监视器</h2>
                  </div>
                  <div className="bg-muted/20 max-h-48 overflow-y-auto border">
                    <div className="text-foreground space-y-1 p-3 font-mono text-xs leading-5">
                      {session.serialLog.map((entry) => (
                        <div
                          key={entry.id}
                          className={
                            entry.direction === "input"
                              ? "text-sky-700"
                              : entry.direction === "system"
                                ? "text-muted-foreground"
                                : "text-emerald-700"
                          }
                        >
                          <span className="text-muted-foreground/70 mr-2">
                            {entry.direction === "input"
                              ? ">"
                              : entry.direction === "output"
                                ? "<"
                                : "#"}
                          </span>
                          <span className="break-all">{entry.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={serialInput}
                      onChange={(event) => setSerialInput(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && sendSerial()}
                      placeholder="发送串口数据"
                    />
                    <Button
                      size="icon"
                      title="发送"
                      disabled={!serialInput.trim()}
                      onClick={sendSerial}
                    >
                      <Send />
                    </Button>
                  </div>
                </section>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
              正在准备虚拟开发板
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
