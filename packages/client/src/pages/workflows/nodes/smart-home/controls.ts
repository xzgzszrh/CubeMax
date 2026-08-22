import type { XiaomiHomeCapability, XiaomiHomeDevice, YeelightProDevice } from "@buildingai/services/web";

export type SmartHomeProvider = "xiaomi" | "yeelight";

export type SmartHomeControlCommand = {
  on?: boolean;
  brightness?: number;
  color?: string;
  colorTemp?: number;
  mode?: "color" | "white";
  targetTemperature?: number;
  coverAction?: "open" | "close" | "stop";
  position?: number;
  speed?: number;
  oscillate?: boolean;
  properties?: Array<{ siid?: number; piid?: number; name?: string; value: unknown }>;
};

export type UnifiedSmartHomeDevice = {
  id: string;
  provider: SmartHomeProvider;
  name: string;
  model: string | null;
  category: string;
  categoryLabel: string;
  online: boolean;
  homeName: string | null;
  roomName: string | null;
  capabilities: XiaomiHomeCapability[];
  state: Record<string, unknown>;
};

const LABELS: Record<string, string> = {
  on: "开关",
  power: "电源",
  brightness: "亮度",
  color_temperature: "色温",
  color: "颜色",
  temperature: "温度",
  relative_humidity: "湿度",
  humidity: "湿度",
  mode: "模式",
  target_temperature: "目标温度",
  volume: "音量",
  fan_level: "风速",
  speed: "速度",
  oscillate: "摇头",
  open: "打开",
  close: "关闭",
  stop: "停止",
};

export const CATEGORY_LABELS: Record<string, string> = {
  binary_sensor: "二进制传感器",
  button: "按钮",
  camera: "摄像头",
  climate: "空调与温控",
  cover: "窗帘",
  fan: "风扇",
  humidifier: "加湿器",
  light: "灯光",
  lock: "门锁",
  media_player: "媒体设备",
  sensor: "传感器",
  switch: "开关",
  vacuum: "扫地机器人",
  air_purifier: "空气净化器",
  other: "其他设备",
};

export function capabilityName(capability: { name?: string }): string {
  return String(capability.name || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]/g, "_");
}

export function formatCapabilityLabel(name?: string, fallback = "设备属性"): string {
  const normalized = capabilityName({ name });
  if (LABELS[normalized]) return LABELS[normalized];
  if (fallback && !/[A-Za-z]/.test(fallback)) return fallback;
  return fallback;
}

export function getCategoryLabel(category: string, fallback?: string | null): string {
  return CATEGORY_LABELS[category] || (fallback && !/[A-Za-z]/.test(fallback) ? fallback : "其他设备");
}

export function packedRgbToHex(value: unknown): string {
  const packed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^#?[0-9a-fA-F]{6}$/.test(value)
        ? Number.parseInt(value.replace("#", ""), 16)
        : Number(value);
  if (!Number.isFinite(packed)) return "#ffffff";
  return `#${Math.max(0, Math.min(0xffffff, packed)).toString(16).padStart(6, "0")}`;
}

export function isRgbColorCapability(capability: XiaomiHomeCapability): boolean {
  const name = capabilityName(capability);
  const unit = String(capability.unit || "").toLowerCase();
  return capability.format === "rgb" || unit === "rgb" || name === "color" || name === "c";
}

export function getState(device: UnifiedSmartHomeDevice, capability: XiaomiHomeCapability): unknown {
  if (capability.piid === undefined) return undefined;
  return device.state[`${capability.siid}.${capability.piid}`];
}

function findLightCapability(device: UnifiedSmartHomeDevice, names: string[]) {
  const wanted = new Set(names);
  return device.capabilities.find(
    (capability) =>
      capability.kind === "property" &&
      capability.piid !== undefined &&
      capability.access?.includes("write") &&
      wanted.has(capabilityName(capability)),
  );
}

export function lightControlMap(device: UnifiedSmartHomeDevice) {
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

export function unifyXiaomiDevice(device: XiaomiHomeDevice): UnifiedSmartHomeDevice {
  return {
    id: device.id,
    provider: "xiaomi",
    name: device.name,
    model: device.model,
    category: device.category,
    categoryLabel: device.categoryLabel,
    online: device.online,
    homeName: device.homeName,
    roomName: device.roomName,
    capabilities: device.capabilities,
    state: device.state,
  };
}

export function unifyYeelightDevice(device: YeelightProDevice): UnifiedSmartHomeDevice {
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
    name: device.name,
    model: device.model,
    category: device.category,
    categoryLabel: device.categoryLabel,
    online: device.online,
    homeName: device.houseName,
    roomName: device.roomName,
    capabilities,
    state: Object.fromEntries(
      device.capabilities.map((capability, index) => [`1.${index + 1}`, device.state[capability.name]]),
    ),
  };
}

export function defaultCommandForCategory(category: string): SmartHomeControlCommand {
  if (category === "light" || category === "switch" || category === "fan" || category === "climate") {
    return { on: true };
  }
  if (category === "cover") return { coverAction: "open" };
  return {};
}

export function commandSummary(command: SmartHomeControlCommand | undefined): string {
  if (!command) return "尚未配置控制";
  const parts: string[] = [];
  if (command.on === true) parts.push("开启");
  if (command.on === false) parts.push("关闭");
  if (command.brightness !== undefined) parts.push(`亮度 ${Math.round(command.brightness)}%`);
  if (command.colorTemp !== undefined) parts.push(`色温 ${Math.round(command.colorTemp)}K`);
  if (command.color) parts.push("彩光");
  if (command.mode === "white") parts.push("白光");
  if (command.mode === "color") parts.push("彩光模式");
  if (command.targetTemperature !== undefined) parts.push(`目标 ${command.targetTemperature}°`);
  if (command.coverAction === "open") parts.push("打开窗帘");
  if (command.coverAction === "close") parts.push("关闭窗帘");
  if (command.coverAction === "stop") parts.push("停止");
  if (command.speed !== undefined) parts.push(`风速 ${command.speed}`);
  if (command.oscillate === true) parts.push("摇头");
  if (command.oscillate === false) parts.push("停止摇头");
  return parts.length ? parts.join(" · ") : "读取当前状态";
}
