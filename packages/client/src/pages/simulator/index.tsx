import {
  type SimulatorSession,
  useCreateSimulatorSessionMutation,
  useDeleteSimulatorSessionMutation,
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
import { Slider } from "@buildingai/ui/components/ui/slider";
import {
  Activity,
  Box,
  CircleGauge,
  Copy,
  Cpu,
  Lightbulb,
  Plus,
  RotateCcw,
  Send,
  Terminal,
  Trash2,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const LEFT_PINS = [
  "3V3",
  "EN",
  "VP",
  "VN",
  "34",
  "35",
  "32",
  "33",
  "25",
  "26",
  "27",
  "14",
  "12",
  "GND",
  "13",
];
const RIGHT_PINS = [
  "VIN",
  "GND",
  "23",
  "22",
  "TX0",
  "RX0",
  "21",
  "GND",
  "19",
  "18",
  "5",
  "17",
  "16",
  "4",
  "2",
];

function PinRail({ pins, session }: { pins: string[]; session: SimulatorSession }) {
  return (
    <div className="flex flex-col justify-between py-2">
      {pins.map((name) => {
        const state = session.pins[name];
        const active = !!state?.digitalValue || (state?.pwmDutyCycle ?? 0) > 0;
        return (
          <div key={name} className="flex h-6 items-center gap-1.5 text-[10px] font-medium">
            <span
              className={`size-2.5 shrink-0 rounded-sm border ${
                active ? "border-amber-400 bg-amber-300" : "border-zinc-500 bg-zinc-300"
              }`}
            />
            <span className={active ? "text-amber-200" : "text-zinc-200"}>{name}</span>
          </div>
        );
      })}
    </div>
  );
}

function DevBoard({ session }: { session: SimulatorSession }) {
  const { led, button, buzzer, servo } = session.peripherals;
  return (
    <div className="relative mx-auto w-full max-w-[620px] px-2 py-5 sm:px-8">
      <div className="relative grid aspect-[1.5/1] min-h-[360px] grid-cols-[52px_1fr_52px] overflow-hidden rounded-md border border-emerald-950 bg-emerald-700 p-3 shadow-xl shadow-black/10">
        <PinRail pins={LEFT_PINS} session={session} />
        <div className="relative flex min-w-0 flex-col items-center justify-between py-4">
          <div className="h-14 w-28 rounded-sm border-2 border-zinc-400 bg-zinc-200 shadow-inner">
            <div className="mx-auto mt-2 h-5 w-20 rounded-sm bg-zinc-400" />
          </div>

          <div className="relative flex h-[46%] w-[70%] items-center justify-center rounded-sm border border-zinc-500 bg-zinc-800 shadow-md">
            <div className="absolute inset-2 border border-zinc-600" />
            <div className="text-center text-zinc-200">
              <Cpu className="mx-auto mb-2 size-8" />
              <div className="text-sm font-semibold">ESP-WROOM-32</div>
              <div className="mt-1 text-[10px] text-zinc-400">2.4 GHz Wi-Fi + Bluetooth</div>
            </div>
          </div>

          <div className="flex w-full items-center justify-around px-2">
            <div className="text-center">
              <div
                className={`mx-auto size-4 rounded-full border-2 ${led.on ? "border-amber-200 bg-amber-400 shadow-[0_0_18px_#fbbf24]" : "border-zinc-400 bg-zinc-700"}`}
              />
              <span className="mt-1 block text-[9px] text-emerald-100">LED · GPIO {led.pin}</span>
            </div>
            <div className="text-center">
              <div
                className={`mx-auto size-6 rounded-sm border-2 ${button.pressed ? "translate-y-0.5 border-zinc-500 bg-zinc-800" : "border-zinc-300 bg-zinc-600"}`}
              />
              <span className="mt-1 block text-[9px] text-emerald-100">
                BOOT · GPIO {button.pin}
              </span>
            </div>
          </div>

          <div className="absolute top-1/2 left-0 h-px w-[15%] bg-cyan-300/80" />
          <div className="absolute top-1/2 right-0 h-px w-[15%] bg-cyan-300/80" />
          {buzzer.active && (
            <div className="absolute top-1/2 right-0 size-2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
          )}
          <div
            className="absolute top-1/2 left-0 h-1 w-12 origin-left rounded-full bg-orange-300 transition-transform"
            style={{ transform: `rotate(${servo.angle - 90}deg)` }}
          />
        </div>
        <div className="flex flex-col items-end">
          <PinRail pins={RIGHT_PINS} session={session} />
        </div>
      </div>
      <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
        <span>{session.board.name}</span>
        <span>3.3 V · 修订 {session.revision}</span>
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
  const sessions = sessionsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const [potentiometer, setPotentiometer] = useState(2048);
  const [serialInput, setSerialInput] = useState("");
  const didCreateDefault = useRef(false);

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
    onSuccess: () => toast.success("开发板已复位"),
    onError: (error) => toast.error(error.message),
  });
  const inputMutation = useUpdateSimulatorInputMutation({
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

  const sendSerial = () => {
    const text = serialInput.trim();
    if (session && text) serialMutation.mutate({ id: session.id, text });
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex min-h-16 items-center gap-3 border-b px-4 py-2.5">
        <Cpu className="text-primary size-5" />
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-base font-semibold">硬件仿真</h1>
          <p className="text-muted-foreground truncate text-xs">ESP32 教学型虚拟开发板</p>
        </div>
        {session && <Badge variant="outline">运行中</Badge>}
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

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[220px_minmax(420px,1fr)_320px]">
        <aside className="flex min-h-0 flex-col border-r max-lg:hidden">
          <div className="flex h-14 items-center justify-between border-b px-3">
            <h2 className="text-sm font-medium">虚拟开发板</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              title="新建开发板"
              onClick={() => createMutation.mutate(undefined)}
              disabled={createMutation.isPending}
            >
              <Plus />
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 p-2">
              {sessions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-left ${item.id === selectedId ? "bg-accent" : "hover:bg-muted"}`}
                >
                  <Cpu className="size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <div className="text-muted-foreground truncate text-[11px]">
                      {item.id.slice(0, 8)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t p-2">
            <Button
              variant="ghost"
              className="text-destructive w-full justify-start"
              disabled={!session || deleteMutation.isPending}
              onClick={() => session && deleteMutation.mutate(session.id)}
            >
              <Trash2 /> 删除当前会话
            </Button>
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto">
          {session ? (
            <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 py-5 sm:px-8">
              <DevBoard session={session} />
              <section className="mt-auto grid gap-5 border-t pt-5 sm:grid-cols-2">
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
                    className="h-12 w-full"
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
            </div>
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              正在准备虚拟开发板
            </div>
          )}
        </main>

        <aside className="flex min-h-0 flex-col border-l max-lg:hidden">
          <div className="flex h-14 items-center gap-2 border-b px-4">
            <Activity className="size-4" />
            <h2 className="text-sm font-semibold">器件状态</h2>
          </div>
          {session && <PeripheralStatus session={session} />}

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <Terminal className="size-4" />
              <h2 className="text-sm font-semibold">串口监视器</h2>
            </div>
            <ScrollArea className="bg-muted/20 min-h-0 flex-1">
              <div className="text-foreground space-y-1 p-3 font-mono text-xs leading-5">
                {session?.serialLog.map((entry) => (
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
                      {entry.direction === "input" ? ">" : entry.direction === "output" ? "<" : "#"}
                    </span>
                    <span className="break-all">{entry.text}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2 border-t p-3">
              <Input
                value={serialInput}
                onChange={(event) => setSerialInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && sendSerial()}
                placeholder="发送串口数据"
              />
              <Button
                size="icon"
                title="发送"
                disabled={!session || !serialInput.trim()}
                onClick={sendSerial}
              >
                <Send />
              </Button>
            </div>
          </div>

          {activePins.length > 0 && (
            <div className="max-h-32 overflow-y-auto border-t p-3">
              <div className="mb-2 text-xs font-medium">活动引脚</div>
              <div className="flex flex-wrap gap-1.5">
                {activePins.map(([pin, state]) => (
                  <Badge key={pin} variant="outline" className="font-mono text-[10px]">
                    {pin} · {state.mode} · {state.digitalValue ? "HIGH" : "LOW"}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
