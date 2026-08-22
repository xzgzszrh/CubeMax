import {
  useAllXiaomiHomeDevicesQuery,
  useExecuteXiaomiHomeActionMutation,
  useRefreshXiaomiHomeDeviceMutation,
  useRefreshYeelightProDeviceMutation,
  useSetXiaomiHomePropertyMutation,
  useSetYeelightProPropertyMutation,
  useXiaomiHomeDeviceQuery,
  useYeelightProDeviceQuery,
  useYeelightProDevicesQuery,
  type XiaomiHomeCapability,
  type XiaomiHomeDevice,
  type XiaomiHomePropertyCommand,
  type YeelightProDevice,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@buildingai/ui/components/ui/empty";
import { Input } from "@buildingai/ui/components/ui/input";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Slider } from "@buildingai/ui/components/ui/slider";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { cn } from "@buildingai/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  AirVent,
  Bell,
  Blinds,
  Boxes,
  BrushCleaning,
  Camera,
  ChevronRight,
  CircleGauge,
  Droplets,
  Fan,
  Home,
  Lightbulb,
  LockKeyhole,
  MapPin,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Speaker,
  TextCursorInput,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useSettingsDialog } from "@/components/settings-dialog";

import { PageShell } from "../_components/page-shell";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  binary_sensor: ShieldAlert,
  button: CircleGauge,
  camera: Camera,
  climate: AirVent,
  cover: Blinds,
  device_tracker: MapPin,
  event: Bell,
  fan: Fan,
  humidifier: Droplets,
  light: Lightbulb,
  lock: LockKeyhole,
  media_player: Speaker,
  number: SlidersHorizontal,
  notify: Bell,
  other: Boxes,
  select: SlidersHorizontal,
  sensor: Thermometer,
  switch: Plug,
  text: TextCursorInput,
  vacuum: BrushCleaning,
  water_heater: Thermometer,
  air_purifier: Wind,
};

const CATEGORY_LABELS: Record<string, string> = {
  binary_sensor: "二进制传感器",
  button: "按钮",
  camera: "摄像头",
  climate: "空调与温控",
  cover: "窗帘",
  device_tracker: "位置追踪",
  event: "事件",
  fan: "风扇",
  humidifier: "加湿器",
  light: "灯光",
  lock: "门锁",
  media_player: "媒体设备",
  number: "数值控制",
  notify: "通知",
  other: "其他设备",
  select: "选择器",
  sensor: "传感器",
  switch: "开关",
  text: "文本控制",
  vacuum: "扫地机器人",
  water_heater: "热水器",
  air_purifier: "空气净化器",
};

const CATEGORY_ORDER = [
  "light",
  "switch",
  "climate",
  "fan",
  "air_purifier",
  "humidifier",
  "cover",
  "media_player",
  "vacuum",
  "water_heater",
  "lock",
  "camera",
  "number",
  "select",
  "button",
  "sensor",
  "binary_sensor",
  "device_tracker",
  "event",
  "notify",
  "text",
  "other",
];

const NUMERIC_FORMATS = new Set([
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "int8",
  "int16",
  "int32",
  "int64",
  "float",
  "double",
]);

const LABELS: Record<string, string> = {
  on: "开关",
  power: "电源",
  power_consumption: "功耗",
  brightness: "亮度",
  color_temperature: "色温",
  color: "颜色",
  temperature: "温度",
  relative_humidity: "湿度",
  humidity: "湿度",
  mode: "模式",
  target_temperature: "目标温度",
  volume: "音量",
  mute: "静音",
  open: "打开",
  close: "关闭",
  stop: "停止",
  start: "开始",
  pause: "暂停",
  status: "状态",
  battery: "电池",
  battery_level: "电量",
  fan_level: "风速",
  speed: "速度",
  direction: "方向",
  oscillate: "摇头",
  water_level: "水位",
  air_quality: "空气质量",
  state: "状态",
  idle: "待机",
  active: "运行中",
  on_state: "开启",
  off_state: "关闭",
  true: "是",
  false: "否",
};

function getDeviceIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] || Boxes;
}

function getCategoryLabel(category: string, fallback?: string | null): string {
  return (
    CATEGORY_LABELS[category] || (fallback && !/[A-Za-z]/.test(fallback) ? fallback : "其他设备")
  );
}

function formatCapabilityName(value: string | undefined, fallback: string): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, "_");
  if (LABELS[normalized]) return LABELS[normalized];
  if (fallback && !/[A-Za-z]/.test(fallback)) return fallback;
  return "设备属性";
}

function formatServiceName(capability: XiaomiHomeCapability): string {
  const service = capability.serviceName.trim().toLowerCase().replace(/[-\s]/g, "_");
  const serviceLabels: Record<string, string> = {
    power: "电源",
    switch: "开关",
    light: "灯光",
    environment: "环境",
    air_conditioner: "空调",
    fan: "风扇",
    thermostat: "温控",
    battery: "电池",
    lock: "门锁",
    curtain: "窗帘",
    vacuum: "扫地机器人",
    speaker: "音箱",
    media_player: "媒体播放",
  };
  if (serviceLabels[service]) return serviceLabels[service];
  if (capability.serviceDescription && !/[A-Za-z]/.test(capability.serviceDescription)) {
    return capability.serviceDescription;
  }
  return "设备服务";
}

function formatState(value: unknown): string {
  if (typeof value === "boolean") return value ? "开启" : "关闭";
  if (value === null || value === undefined || value === "") return "未读取";
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase().replace(/[-\s]/g, "_");
    return LABELS[normalized] || value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "尚未读取";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getState(device: XiaomiHomeDevice, capability: XiaomiHomeCapability): unknown {
  if (capability.piid === undefined) return undefined;
  return device.state[`${capability.siid}.${capability.piid}`];
}

function capabilityName(capability: XiaomiHomeCapability): string {
  return String(capability.name || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, "_");
}

function isRgbColorCapability(capability: XiaomiHomeCapability): boolean {
  const name = capabilityName(capability);
  const unit = String(capability.unit || "").toLowerCase();
  return capability.format === "rgb" || unit === "rgb" || name === "color" || name === "c";
}

function findLightCapability(device: XiaomiHomeDevice, names: string[]) {
  const wanted = new Set(names);
  return device.capabilities.find(
    (capability) =>
      capability.kind === "property" &&
      capability.piid !== undefined &&
      capability.access?.includes("write") &&
      wanted.has(capabilityName(capability)),
  );
}

function lightControlMap(device: XiaomiHomeDevice) {
  return {
    on: findLightCapability(device, ["on", "p", "power"]),
    brightness: findLightCapability(device, ["brightness", "l"]),
    colorTemp: findLightCapability(device, ["color_temperature", "ct"]),
    color: device.capabilities.find(
      (capability) =>
        capability.kind === "property" &&
        capability.piid !== undefined &&
        capability.access?.includes("write") &&
        isRgbColorCapability(capability),
    ),
    mode: findLightCapability(device, ["mode", "m"]),
  };
}

function isPrimaryLightCapability(
  capability: XiaomiHomeCapability,
  lights: ReturnType<typeof lightControlMap>,
): boolean {
  return Object.values(lights).some(
    (item) => item && item.siid === capability.siid && item.piid === capability.piid,
  );
}

function InteractiveSlider({
  value,
  min,
  max,
  step,
  disabled,
  onCommit,
  label,
  display,
  compact,
  "aria-label": ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
  label?: string;
  display?: (value: number) => string;
  compact?: boolean;
  "aria-label"?: string;
}) {
  const [draft, setDraft] = useState(value);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setDraft(value);
  }, [value]);

  const slider = (
    <Slider
      value={[draft]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onValueChange={(values) => {
        dragging.current = true;
        setDraft(values[0] ?? min);
      }}
      onValueCommit={(values) => {
        dragging.current = false;
        const next = values[0] ?? min;
        setDraft(next);
        if (next !== value) onCommit(next);
      }}
      aria-label={ariaLabel || label}
    />
  );
  const readout = (
    <span className={cn("text-xs tabular-nums", compact && "w-14 shrink-0 text-right")}>
      {display ? display(draft) : formatState(draft)}
    </span>
  );

  if (compact) {
    return (
      <div className="flex w-full min-w-32 items-center gap-3 sm:max-w-52">
        {slider}
        {readout}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border px-3 py-3">
      {label ? (
        <div className="flex items-center justify-between text-sm">
          <span>{label}</span>
          {readout}
        </div>
      ) : null}
      {slider}
    </div>
  );
}

function parseInputValue(format: string | undefined, value: string): unknown {
  if (format === "bool") return value === "true";
  if (NUMERIC_FORMATS.has(format || "")) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

function PropertyEditor({
  device,
  capability,
  disabled,
  onChange,
}: {
  device: XiaomiHomeDevice;
  capability: XiaomiHomeCapability;
  disabled: boolean;
  onChange: (command: XiaomiHomePropertyCommand) => void;
}) {
  const value = getState(device, capability);
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));

  useEffect(() => {
    setDraft(value === undefined ? "" : String(value));
  }, [value]);

  if (isRgbColorCapability(capability) || capability.format === "rgb") {
    return (
      <input
        type="color"
        value={packedRgbToHex(value)}
        onChange={(event) =>
          onChange({
            siid: capability.siid,
            piid: capability.piid!,
            value: event.target.value,
          })
        }
        disabled={disabled}
        aria-label={formatCapabilityName(capability.name, capability.description || "颜色")}
        className="h-8 w-16 cursor-pointer rounded border bg-transparent p-0.5"
      />
    );
  }

  if (capability.format === "bool") {
    return (
      <Switch
        checked={value === true || value === 1 || value === "true"}
        onCheckedChange={(checked) =>
          onChange({ siid: capability.siid, piid: capability.piid!, value: checked })
        }
        disabled={disabled}
        aria-label={formatCapabilityName(capability.name, capability.description || "开关")}
      />
    );
  }

  if (capability.valueList?.length) {
    return (
      <Select
        value={value === undefined ? undefined : String(value)}
        onValueChange={(next) => {
          const option = capability.valueList?.find((item) => String(item.value) === next);
          onChange({ siid: capability.siid, piid: capability.piid!, value: option?.value ?? next });
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="w-full min-w-28 sm:w-36">
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent>
          {capability.valueList.map((item) => (
            <SelectItem key={String(item.value)} value={String(item.value)}>
              {formatState(item.description || item.value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (capability.valueRange && NUMERIC_FORMATS.has(capability.format || "")) {
    const numericValue =
      typeof value === "number" ? value : Number(value ?? capability.valueRange.min);
    const sliderValue = Number.isFinite(numericValue) ? numericValue : capability.valueRange.min;
    return (
      <InteractiveSlider
        compact
        value={sliderValue}
        min={capability.valueRange.min}
        max={capability.valueRange.max}
        step={capability.valueRange.step || 1}
        disabled={disabled}
        display={(next) => `${formatState(next)}${capability.unit ? ` ${capability.unit}` : ""}`}
        onCommit={(next) =>
          onChange({ siid: capability.siid, piid: capability.piid!, value: next })
        }
        aria-label={formatCapabilityName(capability.name, capability.description || "数值")}
      />
    );
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft === "" && value === undefined) return;
        onChange({
          siid: capability.siid,
          piid: capability.piid!,
          value: parseInputValue(capability.format, draft),
        });
      }}
      disabled={disabled}
      className="h-8 w-full sm:max-w-44"
      aria-label={formatCapabilityName(capability.name, capability.description || "设备属性")}
    />
  );
}

function ActionControl({
  capability,
  disabled,
  onExecute,
}: {
  capability: XiaomiHomeCapability;
  disabled: boolean;
  onExecute: (values: unknown[]) => void;
}) {
  const inputs = capability.input || [];
  const [values, setValues] = useState<string[]>(() => inputs.map(() => ""));

  const setValue = (index: number, value: string) =>
    setValues((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
      {inputs.map((input, index) => {
        const label = formatCapabilityName(input.name, input.description || "动作参数");
        if (input.format === "bool") {
          return (
            <Select
              key={`${input.piid}-${index}`}
              value={values[index] || undefined}
              onValueChange={(value) => setValue(index, value)}
              disabled={disabled}
            >
              <SelectTrigger size="sm" className="w-28" aria-label={label}>
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">开启</SelectItem>
                <SelectItem value="false">关闭</SelectItem>
              </SelectContent>
            </Select>
          );
        }
        if (input.valueList?.length) {
          return (
            <Select
              key={`${input.piid}-${index}`}
              value={values[index] || undefined}
              onValueChange={(value) => setValue(index, value)}
              disabled={disabled}
            >
              <SelectTrigger size="sm" className="w-32" aria-label={label}>
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                {input.valueList.map((option) => (
                  <SelectItem key={String(option.value)} value={String(option.value)}>
                    {formatState(option.description || option.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return (
          <Input
            key={`${input.piid}-${index}`}
            type={NUMERIC_FORMATS.has(input.format || "") ? "number" : "text"}
            min={input.valueRange?.min}
            max={input.valueRange?.max}
            step={input.valueRange?.step}
            value={values[index] || ""}
            onChange={(event) => setValue(index, event.target.value)}
            placeholder={label}
            disabled={disabled}
            className="h-8 w-28 text-xs"
            aria-label={label}
          />
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || values.some((value) => value === "")}
        onClick={() =>
          onExecute(
            inputs.map((input, index) => parseInputValue(input.format, values[index] || "")),
          )
        }
      >
        执行
      </Button>
    </div>
  );
}

function LightControlPanel({
  device,
  disabled,
  onChange,
}: {
  device: XiaomiHomeDevice;
  disabled: boolean;
  onChange: (command: XiaomiHomePropertyCommand) => void;
}) {
  const lights = lightControlMap(device);
  if (!lights.on && !lights.brightness && !lights.color && !lights.colorTemp) return null;

  const onValue = lights.on ? getState(device, lights.on) : undefined;
  const isOn = onValue === true || onValue === 1 || onValue === "true";
  const brightnessCap = lights.brightness;
  const brightnessRange = brightnessCap?.valueRange || { min: 1, max: 100, step: 1 };
  const brightnessRaw = brightnessCap
    ? Number(getState(device, brightnessCap))
    : brightnessRange.min;
  const brightness = Number.isFinite(brightnessRaw) ? brightnessRaw : brightnessRange.min;
  const colorTempCap = lights.colorTemp;
  const colorTempRange = colorTempCap?.valueRange || { min: 1700, max: 6500, step: 1 };
  const colorTempRaw = colorTempCap ? Number(getState(device, colorTempCap)) : colorTempRange.min;
  const colorTemp = Number.isFinite(colorTempRaw) ? colorTempRaw : colorTempRange.min;
  const modeValue = lights.mode ? getState(device, lights.mode) : undefined;
  const colorMode =
    lights.mode?.valueList?.find((item) => /color|rgb|彩光/i.test(String(item.description)))
      ?.value ?? 1;
  const whiteMode =
    lights.mode?.valueList?.find((item) =>
      /day|ct|white|temp|日光|白光|色温/i.test(String(item.description)),
    )?.value ?? 2;
  const inColorMode =
    modeValue === undefined ||
    String(modeValue) === String(colorMode) ||
    String(modeValue) === "rgb" ||
    String(modeValue) === "color";

  const setCap = (capability: XiaomiHomeCapability | undefined, value: unknown) => {
    if (!capability?.piid) return;
    onChange({ siid: capability.siid, piid: capability.piid, value });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between rounded-md border px-3 py-3">
        <div>
          <div className="text-sm font-medium">电源</div>
          <div className="text-muted-foreground text-xs">{isOn ? "已开启" : "已关闭"}</div>
        </div>
        {lights.on ? (
          <Switch
            checked={isOn}
            disabled={disabled}
            onCheckedChange={(checked) => setCap(lights.on, checked)}
            aria-label="开关"
          />
        ) : null}
      </div>

      {brightnessCap ? (
        <InteractiveSlider
          label="亮度"
          value={brightness}
          min={brightnessRange.min}
          max={brightnessRange.max}
          step={brightnessRange.step || 1}
          disabled={disabled}
          display={(next) =>
            `${Math.round(next)}${brightnessCap.unit === "percentage" || !brightnessCap.unit ? "%" : ` ${brightnessCap.unit}`}`
          }
          onCommit={(next) => setCap(brightnessCap, next)}
          aria-label="亮度"
        />
      ) : null}

      {lights.mode && lights.color && lights.colorTemp ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            variant={inColorMode ? "default" : "outline"}
            disabled={disabled}
            onClick={() => setCap(lights.mode, colorMode)}
          >
            彩光
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!inColorMode ? "default" : "outline"}
            disabled={disabled}
            onClick={() => setCap(lights.mode, whiteMode)}
          >
            白光
          </Button>
        </div>
      ) : null}

      {lights.color && (inColorMode || !lights.colorTemp) ? (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-3">
          <div>
            <div className="text-sm font-medium">颜色</div>
            <div className="text-muted-foreground text-xs">16 百万色</div>
          </div>
          <input
            type="color"
            value={packedRgbToHex(getState(device, lights.color))}
            disabled={disabled}
            onChange={(event) => setCap(lights.color, event.target.value)}
            aria-label="颜色"
            className="h-10 w-16 cursor-pointer rounded border bg-transparent p-0.5"
          />
        </div>
      ) : null}

      {colorTempCap && (!inColorMode || !lights.color) ? (
        <InteractiveSlider
          label="色温"
          value={colorTemp}
          min={colorTempRange.min}
          max={colorTempRange.max}
          step={colorTempRange.step || 1}
          disabled={disabled}
          display={(next) => `${Math.round(next)} K`}
          onCommit={(next) => setCap(colorTempCap, next)}
          aria-label="色温"
        />
      ) : null}
    </section>
  );
}

function DeviceControlDialog({
  device,
  open,
  onOpenChange,
  onRefresh,
  onProperty,
  onAction,
  pendingKey,
  refreshing,
}: {
  device: XiaomiHomeDevice | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
  onProperty: (command: XiaomiHomePropertyCommand) => void;
  onAction: (capability: XiaomiHomeCapability, values: unknown[]) => void;
  pendingKey: string | null;
  refreshing: boolean;
}) {
  if (!device) return null;
  const Icon = getDeviceIcon(device.category);
  const lights = lightControlMap(device);
  const hasLightPanel = Boolean(lights.on || lights.brightness || lights.color || lights.colorTemp);
  const capabilities = device.capabilities.filter(
    (capability) =>
      ((capability.kind === "property" && capability.piid !== undefined) ||
        (capability.kind === "action" && capability.aiid !== undefined)) &&
      !(hasLightPanel && isPrimaryLightCapability(capability, lights)),
  );
  const groups = new Map<
    string,
    { label: string; properties: XiaomiHomeCapability[]; actions: XiaomiHomeCapability[] }
  >();
  for (const capability of capabilities) {
    const current = groups.get(capability.serviceName) || {
      label: formatServiceName(capability),
      properties: [],
      actions: [],
    };
    if (capability.kind === "property") current.properties.push(capability);
    else current.actions.push(capability);
    groups.set(capability.serviceName, current);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(760px,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-5 py-5 text-left sm:px-6">
          <div className="flex items-start gap-3 pr-6">
            <span className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">{device.name}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{getCategoryLabel(device.category, device.categoryLabel)}</span>
                <span aria-hidden="true">·</span>
                <span>{device.roomName || device.homeName || "未分配房间"}</span>
              </DialogDescription>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Badge
              variant="outline"
              className={
                device.online ? "border-emerald-300 text-emerald-700" : "text-muted-foreground"
              }
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  device.online ? "bg-emerald-500" : "bg-zinc-400",
                )}
              />
              {device.online ? "在线" : "离线"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} />
              刷新状态
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-5 sm:p-6">
            {hasLightPanel ? (
              <LightControlPanel
                device={device}
                disabled={Boolean(pendingKey)}
                onChange={onProperty}
              />
            ) : null}
            {[...groups.entries()].map(([serviceName, group]) => (
              <section key={serviceName}>
                <h3 className="text-muted-foreground mb-2 text-xs font-medium">{group.label}</h3>
                <div className="divide-y rounded-md border">
                  {group.properties.map((capability) => {
                    const key = `${capability.siid}.${capability.piid}`;
                    const readable = capability.access?.includes("read");
                    const writable = capability.access?.includes("write");
                    const value = getState(device, capability);
                    return (
                      <div
                        key={key}
                        className="flex min-h-14 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm">
                            {formatCapabilityName(
                              capability.name,
                              capability.description || "设备属性",
                            )}
                          </div>
                          <div className="text-muted-foreground mt-0.5 truncate text-xs">
                            {capability.unit
                              ? `单位：${capability.unit}`
                              : readable
                                ? "可读取"
                                : "只读不可用"}
                          </div>
                        </div>
                        {writable ? (
                          <PropertyEditor
                            device={device}
                            capability={capability}
                            disabled={pendingKey === key}
                            onChange={onProperty}
                          />
                        ) : (
                          <span className="text-muted-foreground text-left text-xs tabular-nums sm:max-w-40 sm:text-right">
                            {readable ? formatState(value) : "不可用"}
                            {capability.unit ? ` ${capability.unit}` : ""}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {group.actions.map((capability) => {
                    const key = `${capability.siid}.${capability.aiid}`;
                    return (
                      <div
                        key={key}
                        className="flex min-h-14 flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm">
                            {formatCapabilityName(
                              capability.name,
                              capability.description || "设备动作",
                            )}
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-xs">可执行动作</div>
                        </div>
                        <ActionControl
                          capability={capability}
                          disabled={pendingKey === key}
                          onExecute={(values) => onAction(capability, values)}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            {!groups.size && !hasLightPanel ? (
              <Empty className="min-h-48 border-dashed p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Boxes />
                  </EmptyMedia>
                  <EmptyTitle>暂无可用控制项</EmptyTitle>
                  <EmptyDescription>该设备没有返回可读取或可控制的属性。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </div>
        </ScrollArea>

        <DialogFooter className="text-muted-foreground flex-row flex-wrap items-center justify-start border-t px-5 py-3 text-xs sm:px-6">
          <span className="truncate">型号：{device.model || "未知"}</span>
          <span aria-hidden="true">·</span>
          <span>最近读取：{formatDate(device.lastStateAt)}</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ListedSmartHomeDevice = XiaomiHomeDevice & { provider?: "xiaomi" | "yeelight" };

function packedRgbToHex(value: unknown): string {
  const packed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^#?[0-9a-fA-F]{6}$/.test(value)
        ? Number.parseInt(value.replace("#", ""), 16)
        : Number(value);
  if (!Number.isFinite(packed)) return "#ffffff";
  return `#${Math.max(0, Math.min(0xffffff, packed)).toString(16).padStart(6, "0")}`;
}

function toListedYeelightDevice(device: YeelightProDevice): ListedSmartHomeDevice {
  const capabilities: XiaomiHomeCapability[] = device.capabilities.map((capability, index) => ({
    kind: "property",
    siid: 1,
    piid: index + 1,
    serviceName: "light",
    serviceDescription: "彩光灯",
    name: capability.name,
    description: capability.description,
    format: capability.format,
    access: capability.access,
    unit: capability.unit,
    valueRange: capability.valueRange,
    valueList: capability.valueList,
  }));
  return {
    id: device.id,
    provider: "yeelight",
    accountId: device.accountId,
    did: device.did,
    name: device.name,
    model: device.model,
    urn: null,
    manufacturer: "Yeelight",
    icon: device.icon,
    category: device.category,
    categoryLabel: device.categoryLabel,
    online: device.online,
    connectType: null,
    homeId: device.houseId,
    homeName: device.houseName,
    roomId: device.roomId,
    roomName: device.roomName,
    capabilities,
    state: Object.fromEntries(
      device.capabilities.map((capability, index) => [
        `1.${index + 1}`,
        device.state[capability.name],
      ]),
    ),
    metadata: device.metadata,
    lastStateAt: device.lastStateAt,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
  };
}

export default function SmartHomePage() {
  const settingsDialog = useSettingsDialog();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [selectedHomeId, setSelectedHomeId] = useState("all");
  const [selectedRoomId, setSelectedRoomId] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const deferredKeyword = useDeferredValue(keyword.trim().toLocaleLowerCase());

  const xiaomiQuery = useAllXiaomiHomeDevicesQuery();
  const yeelightQuery = useYeelightProDevicesQuery();
  const devicesQuery = {
    isLoading: xiaomiQuery.isLoading || yeelightQuery.isLoading,
    isError: xiaomiQuery.isError && yeelightQuery.isError,
    isFetching: xiaomiQuery.isFetching || yeelightQuery.isFetching,
    refetch: () => {
      void xiaomiQuery.refetch();
      void yeelightQuery.refetch();
    },
  };
  const devices = useMemo<ListedSmartHomeDevice[]>(
    () => [
      ...(xiaomiQuery.data || []).map((device) => ({ ...device, provider: "xiaomi" as const })),
      ...(yeelightQuery.data || []).map(toListedYeelightDevice),
    ],
    [xiaomiQuery.data, yeelightQuery.data],
  );
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId);
  const isYeelight = selectedDevice?.provider === "yeelight";
  const detailQuery = useXiaomiHomeDeviceQuery(selectedDeviceId, {
    enabled: Boolean(selectedDeviceId) && !isYeelight,
  });
  const yeelightDetailQuery = useYeelightProDeviceQuery(selectedDeviceId, {
    enabled: Boolean(selectedDeviceId) && isYeelight,
  });
  // The card data is used as an immediate fallback while the detail request refreshes its state.
  const detailDevice =
    (isYeelight && yeelightDetailQuery.data
      ? toListedYeelightDevice(yeelightDetailQuery.data)
      : detailQuery.data) || selectedDevice;

  const homes = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const device of devices) {
      const id = device.homeId || "unassigned";
      const current = map.get(id) || {
        id,
        name: device.homeName || "未命名家庭",
        count: 0,
      };
      current.count += 1;
      map.set(id, current);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }, [devices]);

  const rooms = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const device of devices) {
      if (selectedHomeId !== "all" && (device.homeId || "unassigned") !== selectedHomeId) continue;
      const id = device.roomId || "unassigned";
      const current = map.get(id) || {
        id,
        name: device.roomName || "未分配房间",
        count: 0,
      };
      current.count += 1;
      map.set(id, current);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }, [devices, selectedHomeId]);

  const categories = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const device of devices) {
      const current = counts.get(device.category) || {
        label: getCategoryLabel(device.category, device.categoryLabel),
        count: 0,
      };
      current.count += 1;
      counts.set(device.category, current);
    }
    return [...counts.entries()].sort((a, b) => {
      const order = CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]);
      return order || a[1].label.localeCompare(b[1].label, "zh-CN");
    });
  }, [devices]);

  const visibleDevices = useMemo(
    () =>
      devices.filter((device) => {
        if (selectedHomeId !== "all" && (device.homeId || "unassigned") !== selectedHomeId)
          return false;
        if (selectedRoomId !== "all" && (device.roomId || "unassigned") !== selectedRoomId)
          return false;
        if (selectedCategory !== "all" && device.category !== selectedCategory) return false;
        if (!deferredKeyword) return true;
        return [
          device.name,
          device.model,
          device.roomName,
          device.homeName,
          device.categoryLabel,
          getCategoryLabel(device.category, device.categoryLabel),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(deferredKeyword));
      }),
    [devices, deferredKeyword, selectedCategory, selectedHomeId, selectedRoomId],
  );

  const refreshMutation = useRefreshXiaomiHomeDeviceMutation({
    onSuccess: () => toast.success("设备状态已刷新"),
    onError: (error) => toast.error(error.message || "设备状态刷新失败"),
  });
  const yeelightRefreshMutation = useRefreshYeelightProDeviceMutation({
    onSuccess: () => toast.success("设备状态已刷新"),
    onError: (error) => toast.error(error.message || "设备状态刷新失败"),
  });
  const propertyMutation = useSetXiaomiHomePropertyMutation({
    onError: (error) => toast.error(error.message || "设备控制失败"),
  });
  const yeelightPropertyMutation = useSetYeelightProPropertyMutation({
    onError: (error) => toast.error(error.message || "设备控制失败"),
  });
  const actionMutation = useExecuteXiaomiHomeActionMutation({
    onSuccess: () => toast.success("设备动作已执行"),
    onError: (error) => toast.error(error.message || "设备动作执行失败"),
  });

  const setProperty = async (command: XiaomiHomePropertyCommand) => {
    if (!detailDevice) return;
    const key = `${command.siid}.${command.piid}`;
    setPendingKey(key);
    try {
      if (detailDevice.provider === "yeelight") {
        const capability = detailDevice.capabilities.find(
          (item) => item.siid === command.siid && item.piid === command.piid,
        );
        if (!capability) return;
        await yeelightPropertyMutation.mutateAsync({
          deviceId: detailDevice.id,
          command: { name: capability.name, value: command.value },
        });
      } else {
        await propertyMutation.mutateAsync({ deviceId: detailDevice.id, command });
      }
    } finally {
      setPendingKey(null);
    }
  };

  const executeAction = async (capability: XiaomiHomeCapability, values: unknown[]) => {
    if (!detailDevice || capability.aiid === undefined || detailDevice.provider === "yeelight")
      return;
    const key = `${capability.siid}.${capability.aiid}`;
    setPendingKey(key);
    try {
      await actionMutation.mutateAsync({
        deviceId: detailDevice.id,
        command: { siid: capability.siid, aiid: capability.aiid, in: values },
      });
    } finally {
      setPendingKey(null);
    }
  };

  const clearFilters = () => {
    setSelectedHomeId("all");
    setSelectedRoomId("all");
    setSelectedCategory("all");
    setKeyword("");
  };

  return (
    <PageShell
      icon={Home}
      eyebrow="家居设备"
      title="智能家居"
      description="查看并控制已连接的小米设备和易来彩光灯"
      className="max-w-7xl"
      actions={
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => devicesQuery.refetch()}
          disabled={devicesQuery.isFetching}
          aria-label="刷新设备列表"
          title="刷新设备列表"
        >
          <RefreshCw className={cn(devicesQuery.isFetching && "animate-spin")} />
        </Button>
      }
    >
      {devicesQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="bg-background flex min-h-36 flex-col rounded-lg border p-4 shadow-xs"
            >
              <div className="flex items-start justify-between">
                <Skeleton className="size-10 rounded-lg" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="mt-5 h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
              <Skeleton className="mt-auto h-3 w-4/5" />
            </div>
          ))}
        </div>
      ) : devicesQuery.isError ? (
        <Empty className="bg-background min-h-72 rounded-lg border-dashed shadow-xs">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlert />
            </EmptyMedia>
            <EmptyTitle>设备加载失败</EmptyTitle>
            <EmptyDescription>智能家居服务暂时不可用，请稍后重试。</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => devicesQuery.refetch()}>
              <RefreshCw /> 重试
            </Button>
          </EmptyContent>
        </Empty>
      ) : !devices.length ? (
        <Empty className="bg-background min-h-72 rounded-lg border-dashed shadow-xs">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HouseEmptyIcon />
            </EmptyMedia>
            <EmptyTitle>暂无智能家居设备</EmptyTitle>
            <EmptyDescription>
              请先在“我的 → 我的智能家居”中连接小米账号或扫码添加易来账号，再同步家庭设备。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => settingsDialog.open("smartHome")}>
              <Home /> 前往我的智能家居
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <section className="bg-background rounded-lg border p-3 shadow-xs sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索设备、房间或家庭"
                  className="pl-9"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:w-[550px]">
                <Select
                  value={selectedHomeId}
                  onValueChange={(value) => {
                    setSelectedHomeId(value);
                    setSelectedRoomId("all");
                  }}
                >
                  <SelectTrigger aria-label="按家庭筛选">
                    <SelectValue placeholder="全部家庭" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部家庭（{devices.length}）</SelectItem>
                    {homes.map((home) => (
                      <SelectItem key={home.id} value={home.id}>
                        {home.name}（{home.count}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                  <SelectTrigger aria-label="按房间筛选">
                    <SelectValue placeholder="全部房间" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部房间</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}（{room.count}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger aria-label="按类型筛选">
                    <SelectValue placeholder="全部类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部类型</SelectItem>
                    {categories.map(([category, value]) => (
                      <SelectItem key={category} value={category}>
                        {value.label}（{value.count}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span>共 {visibleDevices.length} 台设备</span>
              <span>{devices.filter((device) => device.online).length} 台在线</span>
              {(deferredKeyword ||
                selectedHomeId !== "all" ||
                selectedRoomId !== "all" ||
                selectedCategory !== "all") && (
                <button
                  type="button"
                  className="text-foreground underline underline-offset-4"
                  onClick={clearFilters}
                >
                  清除筛选
                </button>
              )}
            </div>
          </section>

          {visibleDevices.length ? (
            <div className="grid gap-3 pb-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleDevices.map((device) => {
                const Icon = getDeviceIcon(device.category);
                const lights = lightControlMap(device);
                const preview =
                  lights.brightness ||
                  device.capabilities.find(
                    (capability) =>
                      capability.kind === "property" &&
                      capability.access?.includes("read") &&
                      getState(device, capability) !== undefined,
                  );
                return (
                  <button
                    type="button"
                    key={device.id}
                    onClick={() => setSelectedDeviceId(device.id)}
                    className="bg-background hover:border-foreground/25 group focus-visible:ring-ring flex min-h-36 flex-col rounded-lg border p-4 text-left shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="bg-muted flex size-10 items-center justify-center rounded-lg">
                        <Icon className="size-5" />
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            device.online ? "bg-emerald-500" : "bg-zinc-400",
                          )}
                        />
                        {device.online ? "在线" : "离线"}
                      </span>
                    </div>
                    <div className="mt-4 flex min-w-0 items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{device.name}</div>
                        <div className="text-muted-foreground mt-1 truncate text-xs">
                          {device.roomName || device.homeName || "未分配房间"}
                        </div>
                      </div>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="text-muted-foreground mt-3 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">
                        {getCategoryLabel(device.category, device.categoryLabel)}
                      </span>
                      {preview ? (
                        <span className="max-w-24 truncate tabular-nums">
                          {formatState(getState(device, preview))}
                          {preview.unit ? ` ${preview.unit}` : ""}
                        </span>
                      ) : (
                        <span>{device.capabilities.length} 项能力</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Empty className="bg-background min-h-72 rounded-lg border-dashed shadow-xs">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>没有匹配的设备</EmptyTitle>
                <EmptyDescription>尝试调整搜索内容或筛选条件。</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={clearFilters}>
                  <X /> 清除筛选
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </div>
      )}
      <DeviceControlDialog
        device={detailDevice}
        open={Boolean(selectedDeviceId)}
        onOpenChange={(open) => {
          if (!open) setSelectedDeviceId(undefined);
        }}
        onRefresh={() => {
          if (!detailDevice) return;
          if (detailDevice.provider === "yeelight") {
            void yeelightRefreshMutation.mutateAsync(detailDevice.id);
            return;
          }
          void refreshMutation.mutateAsync(detailDevice.id);
        }}
        onProperty={(command) => void setProperty(command)}
        onAction={(capability, values) => void executeAction(capability, values)}
        pendingKey={pendingKey}
        refreshing={
          refreshMutation.isPending ||
          yeelightRefreshMutation.isPending ||
          detailQuery.isFetching ||
          yeelightDetailQuery.isFetching
        }
      />
    </PageShell>
  );
}

function HouseEmptyIcon() {
  return (
    <span className="relative block size-6">
      <Home className="absolute inset-0 size-6" />
      <Plug className="bg-muted absolute right-[-5px] bottom-[-4px] size-3.5" />
    </span>
  );
}
