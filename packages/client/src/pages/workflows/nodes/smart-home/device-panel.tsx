import {
  useAllXiaomiHomeDevicesQuery,
  useXiaomiHomeDeviceQuery,
  useYeelightProDeviceQuery,
  useYeelightProDevicesQuery,
  type XiaomiHomeCapability,
} from "@buildingai/services/web";
import { Slider } from "@buildingai/ui/components/ui/slider";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { cn } from "@buildingai/ui/lib/utils";
import { Select } from "@douyinfe/semi-ui";
import { Field } from "@flowgram.ai/free-layout-editor";
import { useEffect, useMemo, useRef, useState } from "react";

import { FormItem, ReadonlyValue } from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import {
  capabilityName,
  commandSummary,
  formatCapabilityLabel,
  getCategoryLabel,
  getState,
  isRgbColorCapability,
  lightControlMap,
  packedRgbToHex,
  unifyXiaomiDevice,
  unifyYeelightDevice,
  type SmartHomeControlCommand,
  type SmartHomeProvider,
  type UnifiedSmartHomeDevice,
} from "./controls";

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

function InteractiveSlider({
  value,
  min,
  max,
  step,
  disabled,
  onCommit,
  label,
  display,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
  label: string;
  display: (value: number) => string;
}) {
  const [draft, setDraft] = useState(value);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setDraft(value);
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">{display(draft)}</span>
      </div>
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
          onCommit(next);
        }}
        aria-label={label}
      />
    </div>
  );
}

function useBoundDevice(provider?: SmartHomeProvider, deviceId?: string) {
  const xiaomiList = useAllXiaomiHomeDevicesQuery();
  const yeelightList = useYeelightProDevicesQuery();
  const xiaomiDetail = useXiaomiHomeDeviceQuery(deviceId, {
    enabled: Boolean(deviceId) && provider === "xiaomi",
  });
  const yeelightDetail = useYeelightProDeviceQuery(deviceId, {
    enabled: Boolean(deviceId) && provider === "yeelight",
  });

  return useMemo(() => {
    if (provider === "yeelight") {
      const device = yeelightDetail.data || yeelightList.data?.find((item) => item.id === deviceId);
      return device ? unifyYeelightDevice(device) : undefined;
    }
    if (provider === "xiaomi") {
      const device = xiaomiDetail.data || xiaomiList.data?.find((item) => item.id === deviceId);
      return device ? unifyXiaomiDevice(device) : undefined;
    }
    return undefined;
  }, [
    deviceId,
    provider,
    xiaomiDetail.data,
    xiaomiList.data,
    yeelightDetail.data,
    yeelightList.data,
  ]);
}

function patchCommand(
  command: SmartHomeControlCommand | undefined,
  patch: Partial<SmartHomeControlCommand>,
): SmartHomeControlCommand {
  return { ...(command ?? {}), ...patch };
}

function LightPanel({
  device,
  command,
  disabled,
  onChange,
}: {
  device: UnifiedSmartHomeDevice;
  command: SmartHomeControlCommand | undefined;
  disabled: boolean;
  onChange: (command: SmartHomeControlCommand) => void;
}) {
  const lights = lightControlMap(device);
  if (!lights.on && !lights.brightness && !lights.color && !lights.colorTemp) return null;

  const liveOn = lights.on ? getState(device, lights.on) : undefined;
  const isOn = command?.on ?? (liveOn === true || liveOn === 1 || liveOn === "true");
  const brightnessRange = lights.brightness?.valueRange || { min: 1, max: 100, step: 1 };
  const liveBrightness = lights.brightness ? Number(getState(device, lights.brightness)) : undefined;
  const brightness =
    command?.brightness ??
    (Number.isFinite(liveBrightness) ? liveBrightness! : brightnessRange.min);
  const colorTempRange = lights.colorTemp?.valueRange || { min: 1700, max: 6500, step: 1 };
  const liveCt = lights.colorTemp ? Number(getState(device, lights.colorTemp)) : undefined;
  const colorTemp =
    command?.colorTemp ?? (Number.isFinite(liveCt) ? liveCt! : colorTempRange.min);
  const modeValue = command?.mode ?? (lights.mode ? String(getState(device, lights.mode)) : undefined);
  const inColorMode =
    command?.mode === "color" ||
    modeValue === "color" ||
    modeValue === "rgb" ||
    modeValue === "1" ||
    (!command?.mode && !lights.colorTemp);

  return (
    <div className="space-y-4">
      {lights.on ? (
        <div className="flex items-center justify-between rounded-md border px-3 py-3">
          <div>
            <div className="text-sm font-medium">电源</div>
            <div className="text-muted-foreground text-xs">{isOn ? "开启这盏灯" : "关闭这盏灯"}</div>
          </div>
          <Switch
            checked={Boolean(isOn)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(patchCommand(command, { on: checked }))}
            aria-label="开关"
          />
        </div>
      ) : null}

      {lights.brightness ? (
        <InteractiveSlider
          label="亮度"
          value={brightness}
          min={brightnessRange.min}
          max={brightnessRange.max}
          step={brightnessRange.step || 1}
          disabled={disabled}
          display={(next) => `${Math.round(next)}%`}
          onCommit={(next) => onChange(patchCommand(command, { brightness: next, on: true }))}
        />
      ) : null}

      {lights.mode && lights.color && lights.colorTemp ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn(
              "h-8 rounded-md border text-xs",
              inColorMode ? "bg-foreground text-background" : "bg-background",
            )}
            disabled={disabled}
            onClick={() => onChange(patchCommand(command, { mode: "color", on: true }))}
          >
            彩光
          </button>
          <button
            type="button"
            className={cn(
              "h-8 rounded-md border text-xs",
              !inColorMode ? "bg-foreground text-background" : "bg-background",
            )}
            disabled={disabled}
            onClick={() => onChange(patchCommand(command, { mode: "white", on: true }))}
          >
            白光
          </button>
        </div>
      ) : null}

      {lights.color && (inColorMode || !lights.colorTemp) ? (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-3">
          <div>
            <div className="text-sm font-medium">颜色</div>
            <div className="text-muted-foreground text-xs">直接点选，不用填色值</div>
          </div>
          <input
            type="color"
            value={command?.color || packedRgbToHex(lights.color ? getState(device, lights.color) : undefined)}
            disabled={disabled}
            onChange={(event) =>
              onChange(patchCommand(command, { color: event.target.value, mode: "color", on: true }))
            }
            aria-label="颜色"
            className="h-10 w-16 cursor-pointer rounded border bg-transparent p-0.5"
          />
        </div>
      ) : null}

      {lights.colorTemp && (!inColorMode || !lights.color) ? (
        <InteractiveSlider
          label="色温"
          value={colorTemp}
          min={colorTempRange.min}
          max={colorTempRange.max}
          step={colorTempRange.step || 1}
          disabled={disabled}
          display={(next) => `${Math.round(next)} K`}
          onCommit={(next) =>
            onChange(patchCommand(command, { colorTemp: next, mode: "white", on: true }))
          }
        />
      ) : null}
    </div>
  );
}

function SwitchPanel({
  device,
  command,
  disabled,
  onChange,
}: {
  device: UnifiedSmartHomeDevice;
  command: SmartHomeControlCommand | undefined;
  disabled: boolean;
  onChange: (command: SmartHomeControlCommand) => void;
}) {
  const power = lightControlMap(device).on;
  if (!power) return null;
  const liveOn = getState(device, power);
  const isOn = command?.on ?? (liveOn === true || liveOn === 1 || liveOn === "true");
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-3">
      <div>
        <div className="text-sm font-medium">开关</div>
        <div className="text-muted-foreground text-xs">{isOn ? "打开设备" : "关闭设备"}</div>
      </div>
      <Switch
        checked={Boolean(isOn)}
        disabled={disabled}
        onCheckedChange={(checked) => onChange(patchCommand(command, { on: checked }))}
        aria-label="开关"
      />
    </div>
  );
}

function ClimatePanel({
  device,
  command,
  disabled,
  onChange,
}: {
  device: UnifiedSmartHomeDevice;
  command: SmartHomeControlCommand | undefined;
  disabled: boolean;
  onChange: (command: SmartHomeControlCommand) => void;
}) {
  const target = device.capabilities.find(
    (capability) =>
      capability.kind === "property" &&
      capability.access?.includes("write") &&
      ["target_temperature", "temperature"].includes(capabilityName(capability)),
  );
  if (!target?.valueRange) return <SwitchPanel device={device} command={command} disabled={disabled} onChange={onChange} />;
  const live = Number(getState(device, target));
  const value = command?.targetTemperature ?? (Number.isFinite(live) ? live : target.valueRange.min);
  return (
    <div className="space-y-4">
      <SwitchPanel device={device} command={command} disabled={disabled} onChange={onChange} />
      <InteractiveSlider
        label="目标温度"
        value={value}
        min={target.valueRange.min}
        max={target.valueRange.max}
        step={target.valueRange.step || 1}
        disabled={disabled}
        display={(next) => `${Math.round(next)}°`}
        onCommit={(next) => onChange(patchCommand(command, { targetTemperature: next, on: true }))}
      />
    </div>
  );
}

function FanPanel({
  device,
  command,
  disabled,
  onChange,
}: {
  device: UnifiedSmartHomeDevice;
  command: SmartHomeControlCommand | undefined;
  disabled: boolean;
  onChange: (command: SmartHomeControlCommand) => void;
}) {
  const speed = device.capabilities.find(
    (capability) =>
      capability.kind === "property" &&
      capability.access?.includes("write") &&
      ["fan_level", "speed", "level"].includes(capabilityName(capability)) &&
      capability.valueRange,
  );
  return (
    <div className="space-y-4">
      <SwitchPanel device={device} command={command} disabled={disabled} onChange={onChange} />
      {speed?.valueRange ? (
        <InteractiveSlider
          label="风速"
          value={command?.speed ?? Number(getState(device, speed) ?? speed.valueRange.min)}
          min={speed.valueRange.min}
          max={speed.valueRange.max}
          step={speed.valueRange.step || 1}
          disabled={disabled}
          display={(next) => `${Math.round(next)}`}
          onCommit={(next) => onChange(patchCommand(command, { speed: next, on: true }))}
        />
      ) : null}
    </div>
  );
}

function CoverPanel({
  command,
  disabled,
  onChange,
}: {
  command: SmartHomeControlCommand | undefined;
  disabled: boolean;
  onChange: (command: SmartHomeControlCommand) => void;
}) {
  const current = command?.coverAction ?? "open";
  return (
    <div className="grid grid-cols-3 gap-2">
      {([
        ["open", "打开"],
        ["stop", "停止"],
        ["close", "关闭"],
      ] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          className={cn(
            "h-8 rounded-md border text-xs",
            current === value ? "bg-foreground text-background" : "bg-background",
          )}
          onClick={() => onChange(patchCommand(command, { coverAction: value }))}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function GenericCapabilityPanel({
  device,
  command,
  disabled,
  onChange,
}: {
  device: UnifiedSmartHomeDevice;
  command: SmartHomeControlCommand | undefined;
  disabled: boolean;
  onChange: (command: SmartHomeControlCommand) => void;
}) {
  const writable = device.capabilities.filter(
    (capability) =>
      capability.kind === "property" &&
      capability.piid !== undefined &&
      capability.access?.includes("write"),
  );
  if (!writable.length) {
    return (
      <p className="text-muted-foreground text-xs">这台设备没有可写入的控制项，运行时会读取当前状态。</p>
    );
  }

  const currentProperties = command?.properties ?? [];
  const setProperty = (capability: XiaomiHomeCapability, value: unknown) => {
    const next = currentProperties.filter(
      (item) => !(item.siid === capability.siid && item.piid === capability.piid),
    );
    next.push({
      siid: capability.siid,
      piid: capability.piid,
      name: capability.name,
      value,
    });
    onChange(patchCommand(command, { properties: next }));
  };

  const valueOf = (capability: XiaomiHomeCapability) => {
    const pending = currentProperties.find(
      (item) => item.siid === capability.siid && item.piid === capability.piid,
    );
    return pending ? pending.value : getState(device, capability);
  };

  return (
    <div className="divide-y rounded-md border">
      {writable.map((capability) => {
        const value = valueOf(capability);
        const label = formatCapabilityLabel(capability.name, capability.description || "设备属性");
        return (
          <div key={`${capability.siid}.${capability.piid}`} className="space-y-2 px-3 py-3">
            <div className="text-sm">{label}</div>
            {isRgbColorCapability(capability) ? (
              <input
                type="color"
                value={packedRgbToHex(value)}
                disabled={disabled}
                onChange={(event) => setProperty(capability, event.target.value)}
                aria-label={label}
                className="h-8 w-16 cursor-pointer rounded border bg-transparent p-0.5"
              />
            ) : capability.format === "bool" ? (
              <Switch
                checked={value === true || value === 1 || value === "true"}
                disabled={disabled}
                onCheckedChange={(checked) => setProperty(capability, checked)}
                aria-label={label}
              />
            ) : capability.valueList?.length ? (
              <Select
                value={value === undefined ? undefined : String(value)}
                disabled={disabled}
                onChange={(next) => {
                  const option = capability.valueList?.find((item) => String(item.value) === String(next));
                  setProperty(capability, option?.value ?? next);
                }}
                optionList={capability.valueList.map((item) => ({
                  label: String(item.description || item.value),
                  value: String(item.value),
                }))}
                size="small"
                style={{ width: "100%" }}
              />
            ) : capability.valueRange && NUMERIC_FORMATS.has(capability.format || "") ? (
              <InteractiveSlider
                label={label}
                value={Number(value ?? capability.valueRange.min)}
                min={capability.valueRange.min}
                max={capability.valueRange.max}
                step={capability.valueRange.step || 1}
                disabled={disabled}
                display={(next) => `${Math.round(next)}${capability.unit ? ` ${capability.unit}` : ""}`}
                onCommit={(next) => setProperty(capability, next)}
              />
            ) : (
              <p className="text-muted-foreground text-xs">当前值：{String(value ?? "未读取")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BoundDeviceForm({
  provider,
  deviceId,
  deviceName,
  command,
  onCommandChange,
}: {
  provider?: SmartHomeProvider;
  deviceId?: string;
  deviceName?: string;
  command?: SmartHomeControlCommand;
  onCommandChange: (command: SmartHomeControlCommand) => void;
}) {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  const device = useBoundDevice(provider, deviceId);
  const title = device?.name || deviceName || "未选择设备";
  const place = device ? [device.roomName, device.homeName].filter(Boolean).join(" · ") : "";

  if (!isSidebar) {
    return (
      <>
        <FormItem name="设备" type="string">
          <ReadonlyValue value={title} />
        </FormItem>
        <FormItem name="本次控制" type="string">
          <ReadonlyValue value={commandSummary(command)} />
        </FormItem>
      </>
    );
  }

  if (!device) {
    return (
      <FormItem name="设备" required type="string">
        <ReadonlyValue value={deviceId ? "正在读取设备…" : "请从工具页勾选设备后再拖入"} />
      </FormItem>
    );
  }

  const category = device.category;
  return (
    <div className="space-y-4">
      <FormItem name="设备" required type="string">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {getCategoryLabel(category, device.categoryLabel)}
            {place ? ` · ${place}` : ""}
            {device.online ? " · 在线" : " · 离线"}
          </div>
        </div>
      </FormItem>

      {category === "light" ? (
        <LightPanel device={device} command={command} disabled={readonly} onChange={onCommandChange} />
      ) : category === "switch" ? (
        <SwitchPanel device={device} command={command} disabled={readonly} onChange={onCommandChange} />
      ) : category === "climate" ? (
        <ClimatePanel device={device} command={command} disabled={readonly} onChange={onCommandChange} />
      ) : category === "cover" ? (
        <CoverPanel command={command} disabled={readonly} onChange={onCommandChange} />
      ) : category === "fan" || category === "air_purifier" ? (
        <FanPanel
          device={device}
          command={command}
          disabled={readonly}
          onChange={onCommandChange}
        />
      ) : (
        <GenericCapabilityPanel
          device={device}
          command={command}
          disabled={readonly}
          onChange={onCommandChange}
        />
      )}
    </div>
  );
}

export function SmartHomeDevicePanel() {
  return (
    <Field<string | undefined> name="provider">
      {({ field: providerField }) => (
        <Field<string | undefined> name="deviceId">
          {({ field: deviceField }) => (
            <Field<string | undefined> name="deviceName">
              {({ field: nameField }) => (
                <Field<SmartHomeControlCommand | undefined> name="command">
                  {({ field: commandField }) => (
                    <BoundDeviceForm
                      provider={providerField.value as SmartHomeProvider | undefined}
                      deviceId={deviceField.value}
                      deviceName={nameField.value}
                      command={commandField.value}
                      onCommandChange={commandField.onChange}
                    />
                  )}
                </Field>
              )}
            </Field>
          )}
        </Field>
      )}
    </Field>
  );
}
