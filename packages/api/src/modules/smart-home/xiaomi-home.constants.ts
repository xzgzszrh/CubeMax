import type { XiaomiHomeServer } from "@buildingai/db/entities";

export const XIAOMI_HOME_HOME_ASSISTANT_CLIENT_ID = "2882303761520251711";
export const XIAOMI_HOME_OAUTH_CLIENT_ID =
    process.env.XIAOMI_HOME_OAUTH_CLIENT_ID || XIAOMI_HOME_HOME_ASSISTANT_CLIENT_ID;

export const XIAOMI_HOME_OAUTH_AUTH_URL = "https://account.xiaomi.com/oauth2/authorize";
export const XIAOMI_HOME_DEFAULT_API_HOST = "ha.api.io.mi.com";
export const XIAOMI_HOME_DEFAULT_FRONTEND_ORIGIN = "http://127.0.0.1:4091";
export const XIAOMI_HOME_LOCAL_RELAY_ORIGIN = "http://homeassistant.local:8123";
export const XIAOMI_HOME_LOCAL_OAUTH_ENABLED =
    process.env.XIAOMI_HOME_LOCAL_OAUTH_TOKEN_ENABLED === "true" ||
    process.env.XIAOMI_HOME_LOCAL_OAUTH_RELAY_ENABLED === "true";
export const XIAOMI_HOME_OAUTH_SESSION_TTL_MS = 10 * 60 * 1000;
export const XIAOMI_HOME_TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000;
export const XIAOMI_HOME_HTTP_TIMEOUT_MS = 30 * 1000;

export const XIAOMI_HOME_SERVERS: Record<XiaomiHomeServer, string> = {
    cn: "中国大陆",
    de: "欧洲",
    i2: "印度",
    ru: "俄罗斯",
    sg: "新加坡",
    us: "美国",
};

export const XIAOMI_HOME_CATEGORY_LABELS: Record<string, string> = {
    binary_sensor: "二值传感器",
    button: "按钮",
    camera: "摄像头",
    climate: "空调与温控",
    cover: "窗帘与门窗",
    device_tracker: "设备追踪",
    event: "事件",
    fan: "风扇与空气设备",
    humidifier: "加湿器",
    light: "灯光",
    lock: "门锁",
    media_player: "电视与音箱",
    number: "数值控制",
    notify: "通知",
    other: "其他设备",
    select: "模式选择",
    sensor: "传感器",
    switch: "开关与插座",
    text: "文本控制",
    vacuum: "扫地机器人",
    water_heater: "热水器",
};

const CATEGORY_ALIASES: Record<string, string> = {
    acpartner: "climate",
    aircondition: "climate",
    air_conditioner: "climate",
    air_purifier: "fan",
    airpurifier: "fan",
    airfresh: "fan",
    air_fresh: "fan",
    airrtc: "climate",
    binary_sensor: "binary_sensor",
    camera: "camera",
    cateye: "camera",
    curtain: "cover",
    dehumidifier: "humidifier",
    derh: "humidifier",
    door: "binary_sensor",
    fan: "fan",
    feeder: "switch",
    fridge: "sensor",
    heater: "climate",
    humidifier: "humidifier",
    light: "light",
    lock: "lock",
    media_player: "media_player",
    mop: "vacuum",
    mopping_machine: "vacuum",
    motion: "binary_sensor",
    motion_sensor: "binary_sensor",
    number: "number",
    plug: "switch",
    printer: "sensor",
    projector: "media_player",
    remote: "button",
    router: "sensor",
    sensor: "sensor",
    sensor_ht: "sensor",
    switch: "switch",
    television: "media_player",
    tv: "media_player",
    tvbox: "media_player",
    vacuum: "vacuum",
    waterheater: "water_heater",
    water_heater: "water_heater",
    washer: "sensor",
    window_opener: "cover",
    wopener: "cover",
};

// A MIoT device may expose a generic device URN while its services describe a
// more useful Home Assistant domain. Keep the order deliberate: actuator
// domains win over the generic environment/battery services often present on
// the same device.
const SERVICE_CATEGORY_ALIASES: Array<[string, string]> = [
    ["air-conditioner", "climate"],
    ["air_conditioner", "climate"],
    ["thermostat", "climate"],
    ["heater", "climate"],
    ["bath-heater", "climate"],
    ["water-heater", "water_heater"],
    ["water_heater", "water_heater"],
    ["humidifier", "humidifier"],
    ["dehumidifier", "humidifier"],
    ["vacuum", "vacuum"],
    ["curtain", "cover"],
    ["window-opener", "cover"],
    ["motor-controller", "cover"],
    ["airer", "cover"],
    ["light", "light"],
    ["ambient-light", "light"],
    ["night-light", "light"],
    ["white-light", "light"],
    ["indicator-light", "light"],
    ["fan", "fan"],
    ["fan-control", "fan"],
    ["ceiling-fan", "fan"],
    ["air-fresh", "fan"],
    ["air-freshener", "fan"],
    ["air-purifier", "fan"],
    ["speaker", "media_player"],
    ["play-control", "media_player"],
    ["television", "media_player"],
    ["tv-box", "media_player"],
    ["projector", "media_player"],
    ["lock", "lock"],
    ["door-lock", "lock"],
    ["camera", "camera"],
    ["doorbell", "camera"],
    ["motion", "binary_sensor"],
    ["motion-sensor", "binary_sensor"],
    ["door", "binary_sensor"],
    ["smoke-sensor", "binary_sensor"],
    ["switch", "switch"],
    ["outlet", "switch"],
    ["plug", "switch"],
    ["environment", "sensor"],
    ["battery", "sensor"],
];

export function getXiaomiHomeApiHost(cloudServer: XiaomiHomeServer): string {
    return cloudServer === "cn"
        ? XIAOMI_HOME_DEFAULT_API_HOST
        : `${cloudServer}.${XIAOMI_HOME_DEFAULT_API_HOST}`;
}

export function getXiaomiHomeCategory(
    urn?: string | null,
    model?: string | null,
    serviceNames?: Iterable<string>,
): string {
    const fromUrn = urn?.split(":")[3]?.toLowerCase().replace(/-/g, "_");
    if (fromUrn && CATEGORY_ALIASES[fromUrn]) return CATEGORY_ALIASES[fromUrn];

    const fromModel = model?.split(".").slice(1).join(".").toLowerCase().replace(/-/g, "_");
    if (fromModel) {
        for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
            if (fromModel.includes(alias)) return category;
        }
    }

    if (serviceNames) {
        const normalizedServices = new Set(
            [...serviceNames].map((name) => name.toLowerCase().replace(/_/g, "-")),
        );
        for (const [service, category] of SERVICE_CATEGORY_ALIASES) {
            if (normalizedServices.has(service)) return category;
        }
    }
    return "other";
}

export function getXiaomiHomeCategoryLabel(category: string): string {
    return XIAOMI_HOME_CATEGORY_LABELS[category] || XIAOMI_HOME_CATEGORY_LABELS.other;
}
