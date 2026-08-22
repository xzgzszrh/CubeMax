import { createHash } from "node:crypto";

import type { YeelightProRegion } from "@buildingai/db/entities";

export const YEELIGHT_PRO_REGIONS: Record<YeelightProRegion, string> = {
    cn: "中国大陆",
    sg: "新加坡",
    us: "美国",
    de: "欧洲",
};

export const YEELIGHT_PRO_REGION_ROOTS: Record<YeelightProRegion, string> = {
    cn: "https://api.yeelight.com",
    sg: "https://api-sg.yeelight.com",
    us: "https://api-us.yeelight.com",
    de: "https://api-de.yeelight.com",
};

export const YEELIGHT_PRO_HTTP_TIMEOUT_MS = 30_000;
export const YEELIGHT_PRO_QR_TTL_MS = 5 * 60 * 1000;
export const YEELIGHT_PRO_TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000;
export const YEELIGHT_PRO_CONTROL_DURATION_MS = 500;
export const YEELIGHT_PRO_DEVICE_NODE_TYPE = 2;
export const YEELIGHT_PRO_PAGE_SIZE = 200;

export const YEELIGHT_PRO_COLOR_LIGHT_PROPERTIES = [
    "p",
    "l",
    "ct",
    "c",
    "m",
    "slisaon",
    "slisaon_rdy",
    "bp",
    "dd",
] as const;

export type YeelightProColorLightProperty = (typeof YEELIGHT_PRO_COLOR_LIGHT_PROPERTIES)[number];

export function yeelightAccountBaseUrl(region: YeelightProRegion): string {
    return `${YEELIGHT_PRO_REGION_ROOTS[region]}/apis/account`;
}

export function yeelightIotBaseUrl(region: YeelightProRegion): string {
    return `${YEELIGHT_PRO_REGION_ROOTS[region]}/apis/iot`;
}

export function yeelightScanDeviceId(userId: string): string {
    const digest = createHash("sha256")
        .update(`buildingai:yeelight-pro:${userId}`)
        .digest("hex")
        .slice(0, 24);
    return `ba-${digest}`;
}

export function yeelightQrcodeContent(device: string, qrCodeId: string): string {
    return `cli&${device}&${qrCodeId}`;
}

export function normalizeYeelightRegion(value: string | undefined): YeelightProRegion {
    const aliases: Record<string, YeelightProRegion> = {
        cn: "cn",
        china: "cn",
        mainland: "cn",
        sg: "sg",
        singapore: "sg",
        us: "us",
        usa: "us",
        na: "us",
        de: "de",
        eu: "de",
        europe: "de",
    };
    const normalized =
        aliases[
            String(value || "cn")
                .trim()
                .toLowerCase()
        ];
    if (!normalized) throw new Error("不支持的易来云区域");
    return normalized;
}
