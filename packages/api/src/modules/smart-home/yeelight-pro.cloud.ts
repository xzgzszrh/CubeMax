import type { YeelightProCapability, YeelightProRegion } from "@buildingai/db/entities";

import {
    YEELIGHT_PRO_COLOR_LIGHT_PROPERTIES,
    YEELIGHT_PRO_CONTROL_DURATION_MS,
    YEELIGHT_PRO_DEVICE_NODE_TYPE,
    YEELIGHT_PRO_HTTP_TIMEOUT_MS,
    YEELIGHT_PRO_PAGE_SIZE,
    yeelightAccountBaseUrl,
    yeelightIotBaseUrl,
    yeelightQrcodeContent,
} from "./yeelight-pro.constants";
import type {
    YeelightProAccountToken,
    YeelightProCloudDevice,
    YeelightProHouse,
    YeelightProInventory,
    YeelightProNormalizedLight,
    YeelightProScanLoginQrCode,
    YeelightProScanStatus,
} from "./yeelight-pro.types";

const SCAN_STATUSES = new Set(["CREATED", "SCANNED", "CONFIRM", "LOGIN", "EXPIRED"]);

const COLOR_LIGHT_CAPABILITIES: YeelightProCapability[] = [
    {
        kind: "property",
        name: "p",
        description: "开关",
        format: "bool",
        access: ["read", "write"],
    },
    {
        kind: "property",
        name: "l",
        description: "亮度",
        format: "int",
        access: ["read", "write"],
        unit: "%",
        valueRange: { min: 1, max: 100, step: 1 },
    },
    {
        kind: "property",
        name: "ct",
        description: "色温",
        format: "int",
        access: ["read", "write"],
        unit: "K",
        valueRange: { min: 2700, max: 6500, step: 1 },
    },
    {
        kind: "property",
        name: "c",
        description: "颜色",
        format: "rgb",
        access: ["read", "write"],
        unit: "rgb",
    },
    {
        kind: "property",
        name: "m",
        description: "灯光模式",
        format: "enum",
        access: ["read", "write"],
        valueList: [
            { value: "rgb", description: "彩光" },
            { value: "ct", description: "白光" },
            { value: "color", description: "彩光" },
            { value: "color_temp", description: "白光" },
        ],
    },
    {
        kind: "property",
        name: "slisaon",
        description: "夜灯",
        format: "bool",
        access: ["read", "write"],
    },
    {
        kind: "property",
        name: "slisaon_rdy",
        description: "夜灯就绪",
        format: "bool",
        access: ["read"],
    },
    {
        kind: "property",
        name: "bp",
        description: "背景灯",
        format: "bool",
        access: ["read", "write"],
    },
    {
        kind: "property",
        name: "dd",
        description: "延时关闭",
        format: "int",
        access: ["read", "write"],
        unit: "min",
        valueRange: { min: 0, max: 120, step: 1 },
    },
];

export class YeelightProCloudError extends Error {
    constructor(
        message: string,
        public readonly unauthorized = false,
        public readonly status?: number,
    ) {
        super(message);
        this.name = "YeelightProCloudError";
    }
}

function firstValue(record: Record<string, unknown>, ...keys: string[]): unknown {
    for (const key of keys) {
        const value = record[key];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function asText(value: unknown): string {
    return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function asInt(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function listRows(data: unknown): Record<string, unknown>[] {
    const record = asRecord(data);
    if (Array.isArray(data)) {
        return data.filter((item) => asRecord(item)) as Record<string, unknown>[];
    }
    if (!record) return [];
    for (const key of ["rows", "list", "houses", "devices", "rooms", "schemas"]) {
        const value = record[key];
        if (Array.isArray(value)) {
            return value.filter((item) => asRecord(item)) as Record<string, unknown>[];
        }
    }
    return [];
}

function raiseForBody(payload: Record<string, unknown>): void {
    const rawCode = payload.code;
    const code =
        typeof rawCode === "number" && Number.isFinite(rawCode)
            ? String(Math.trunc(rawCode))
            : asText(rawCode);
    const error = asText(payload.error).toLowerCase();
    if ((!code || code === "0" || code === "200") && !error) return;
    const message =
        `${asText(payload.msg) || asText(payload.message)} ${error} ${code}`.toLowerCase();
    if (
        message.includes("invalid_token") ||
        (message.includes("token") && message.includes("invalid"))
    ) {
        throw new YeelightProCloudError("易来账号授权已失效", true);
    }
    if (
        message.includes("access_denied") ||
        message.includes("unauthorized") ||
        message.includes("forbidden") ||
        code === "401" ||
        code === "403"
    ) {
        throw new YeelightProCloudError("易来云拒绝了当前授权", true);
    }
    throw new YeelightProCloudError(
        asText(payload.msg) || asText(payload.message) || `易来云请求失败（${code || "unknown"}）`,
        false,
    );
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text();
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { message: text || "易来云返回了无效响应" };
    }
}

function parseToken(value: unknown): YeelightProAccountToken {
    const record = asRecord(value);
    if (!record) throw new YeelightProCloudError("易来扫码登录没有返回有效 token");
    const accessToken = asText(firstValue(record, "accessToken", "access_token"));
    const refreshToken = asText(firstValue(record, "refreshToken", "refresh_token"));
    const tokenType = asText(firstValue(record, "tokenType", "token_type")) || "Bearer";
    const expiresIn = asInt(firstValue(record, "expiresIn", "expires_in"));
    if (accessToken.length < 20 || refreshToken.length < 20 || !expiresIn || expiresIn <= 0) {
        throw new YeelightProCloudError("易来扫码登录返回了无效 token");
    }
    const userId = asText(firstValue(record, "id", "userId", "user_id")) || null;
    return {
        accessToken,
        tokenType,
        refreshToken,
        expiresIn,
        userId,
        username: asText(record.username),
        clientId: asText(firstValue(record, "clientId", "client_id")),
        clientSecret: asText(firstValue(record, "clientSecret", "client_secret")),
        region: asText(record.region),
        device: asText(record.device),
    };
}

export function parseScanLoginResponse(
    payload: Record<string, unknown>,
): YeelightProScanLoginQrCode {
    raiseForBody(payload);
    const data = asRecord(payload.data);
    if (!data) throw new YeelightProCloudError("易来扫码登录返回了无效数据");
    const status = asText(data.status).toUpperCase() as YeelightProScanStatus;
    if (!SCAN_STATUSES.has(status)) throw new YeelightProCloudError("易来扫码登录状态无效");
    const qrCodeId = asText(firstValue(data, "qrCodeId", "qrcodeId", "qrcodeid", "qr_code_id"));
    const device = asText(data.device);
    if (!qrCodeId || !device) throw new YeelightProCloudError("易来扫码登录缺少二维码信息");
    const token =
        status === "LOGIN" ? parseToken(data.token) : data.token ? parseToken(data.token) : null;
    if (status === "LOGIN" && !token) throw new YeelightProCloudError("易来扫码登录没有返回 token");
    const createAt = asInt(firstValue(data, "createAt", "create_at"));
    const expireIn = asInt(firstValue(data, "expireIn", "expire_in"));
    const expireAt =
        asInt(firstValue(data, "expireAt", "expire_at")) ??
        (createAt != null && expireIn != null ? createAt + expireIn : null);
    return {
        qrCodeId,
        device,
        status,
        expireAtMs: expireAt,
        expireInMs: expireIn,
        token: status === "LOGIN" ? token : null,
    };
}

export function inferYeelightLight(device: YeelightProCloudDevice): YeelightProNormalizedLight {
    const propertyNames = new Set(Object.keys(device.properties));
    const isLight =
        device.category === "light" ||
        ["p", "l", "ct", "c"].some((name) => propertyNames.has(name));
    if (!isLight) {
        return { category: device.category || "other", capabilities: [] };
    }
    const supported = COLOR_LIGHT_CAPABILITIES.filter((capability) => {
        if (propertyNames.size === 0) {
            return ["p", "l", "ct", "c", "m"].includes(capability.name);
        }
        return propertyNames.has(capability.name);
    });
    const capabilities =
        supported.length > 0
            ? supported
            : COLOR_LIGHT_CAPABILITIES.filter((capability) =>
                  ["p", "l", "ct", "c"].includes(capability.name),
              );
    return { category: "light", capabilities };
}

export class YeelightProCloudClient {
    constructor(
        private readonly region: YeelightProRegion,
        private readonly accessToken?: string,
        private readonly clientId?: string,
    ) {}

    static async createQrCode(
        region: YeelightProRegion,
        device: string,
    ): Promise<YeelightProScanLoginQrCode> {
        return this.requestScanLogin(
            region,
            `/user/scan-login/query/qrcode/${encodeURIComponent(device)}`,
        );
    }

    static async checkQrCode(
        region: YeelightProRegion,
        qrCodeId: string,
    ): Promise<YeelightProScanLoginQrCode> {
        return this.requestScanLogin(
            region,
            `/user/scan-login/check/qrcode/${encodeURIComponent(qrCodeId)}`,
        );
    }

    static async refreshToken(params: {
        region: YeelightProRegion;
        clientId: string;
        clientSecret: string;
        refreshToken: string;
    }): Promise<YeelightProAccountToken> {
        const body = new URLSearchParams({
            grant_type: "refresh_token",
            client_id: params.clientId,
            client_secret: params.clientSecret,
            refresh_token: params.refreshToken,
        });
        const payload = await this.requestAccount(params.region, "/oauth/token", body);
        const data = asRecord(payload.data) || payload;
        return parseToken(data);
    }

    private static async requestScanLogin(
        region: YeelightProRegion,
        path: string,
    ): Promise<YeelightProScanLoginQrCode> {
        const payload = await this.requestAccount(region, path, new URLSearchParams());
        return parseScanLoginResponse(payload);
    }

    private static async requestAccount(
        region: YeelightProRegion,
        path: string,
        body: URLSearchParams,
    ): Promise<Record<string, unknown>> {
        let response: Response;
        try {
            response = await fetch(`${yeelightAccountBaseUrl(region)}${path}`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    accept: "application/json",
                },
                body,
                signal: AbortSignal.timeout(YEELIGHT_PRO_HTTP_TIMEOUT_MS),
            });
        } catch (error) {
            throw new YeelightProCloudError(
                `连接易来账号服务失败：${error instanceof Error ? error.message : error}`,
            );
        }
        const payload = await readJson(response);
        if (response.status === 401 || response.status === 403) {
            throw new YeelightProCloudError("易来扫码登录授权失败", true, response.status);
        }
        if (response.status === 429) {
            throw new YeelightProCloudError("易来账号服务请求过于频繁", false, response.status);
        }
        if (!response.ok) {
            throw new YeelightProCloudError(
                asText(payload.msg) ||
                    asText(payload.message) ||
                    `易来扫码登录失败（${response.status}）`,
                false,
                response.status,
            );
        }
        raiseForBody(payload);
        return payload;
    }

    async listHouses(): Promise<YeelightProHouse[]> {
        const rows = await this.paginatedRows("/v1/open/node/house/r/list");
        return rows
            .map((row) => ({
                id: asText(firstValue(row, "id", "houseId", "house_id")),
                name: asText(firstValue(row, "name", "houseName", "house_name")) || "易来家庭",
            }))
            .filter((house) => house.id);
    }

    async getInventory(house: YeelightProHouse): Promise<YeelightProInventory> {
        const [rooms, devices] = await Promise.all([
            this.paginatedRows(`/v1/open/node/house/${house.id}/rooms/r/list`),
            this.paginatedRows(`/v1/open/node/house/${house.id}/devices/r/list`),
        ]);
        const roomNames = new Map(
            rooms
                .map((row) => {
                    const id = asText(firstValue(row, "id", "roomId", "room_id"));
                    const name = asText(firstValue(row, "name", "roomName", "room_name"));
                    return id ? ([id, name || "未命名房间"] as const) : null;
                })
                .filter((item): item is readonly [string, string] => Boolean(item)),
        );
        return {
            houses: [house],
            rooms: [...roomNames.entries()].map(([id, name]) => ({ id, name })),
            devices: devices
                .map((row) => this.normalizeDevice(row, house, roomNames))
                .filter((device) => device.id),
        };
    }

    async readLightState(houseId: string, deviceId: string): Promise<Record<string, unknown>> {
        const payload = await this.requestJson(
            "POST",
            `/v1/open/control/house/${houseId}/control/${YEELIGHT_PRO_DEVICE_NODE_TYPE}/${deviceId}/r/properties`,
            { propNames: [...YEELIGHT_PRO_COLOR_LIGHT_PROPERTIES] },
        );
        return this.normalizePropertyMap(payload.data);
    }

    async setLightProperties(
        houseId: string,
        deviceId: string,
        params: Record<string, unknown>,
        duration = YEELIGHT_PRO_CONTROL_DURATION_MS,
    ): Promise<void> {
        await this.requestJson(
            "POST",
            `/v1/open/control/house/${houseId}/control/${YEELIGHT_PRO_DEVICE_NODE_TYPE}/${deviceId}/w/properties`,
            {
                command: "set",
                params: Object.entries(params).map(([propName, value]) => ({ propName, value })),
                duration,
                category: "light",
            },
        );
    }

    private normalizeDevice(
        row: Record<string, unknown>,
        house: YeelightProHouse,
        roomNames: Map<string, string>,
    ): YeelightProCloudDevice {
        const properties = this.extractProperties(row);
        const roomId = asText(firstValue(row, "roomId", "room_id")) || null;
        const category = asText(firstValue(row, "category", "iotCategory", "type")).toLowerCase();
        return {
            id: asText(firstValue(row, "id", "deviceId", "device_id")),
            name: asText(firstValue(row, "name", "deviceName")) || "易来设备",
            productId: asInt(firstValue(row, "pid", "productId", "product_id")),
            model: asText(firstValue(row, "model", "productModel")) || null,
            icon: asText(firstValue(row, "icon", "iconUrl")) || null,
            category: category === "1" || category === "light" ? "light" : category || "other",
            online: this.asOnline(row, properties),
            roomId,
            roomName: roomId ? roomNames.get(roomId) || asText(row.roomName) || null : null,
            houseId: house.id,
            houseName: house.name,
            properties,
            metadata: row,
        };
    }

    private extractProperties(row: Record<string, unknown>): Record<string, unknown> {
        const properties: Record<string, unknown> = {};
        const params = asRecord(row.params);
        if (params) Object.assign(properties, params);
        const listed = row.properties;
        if (Array.isArray(listed)) {
            for (const item of listed) {
                const record = asRecord(item);
                if (!record) continue;
                const name = asText(firstValue(record, "propName", "name", "id"));
                if (name) properties[name] = firstValue(record, "value", "val");
            }
        } else {
            const record = asRecord(listed);
            if (record) Object.assign(properties, record);
        }
        return properties;
    }

    private asOnline(row: Record<string, unknown>, properties: Record<string, unknown>): boolean {
        const online = firstValue(row, "online", "o") ?? properties.o;
        if (typeof online === "boolean") return online;
        const text = asText(online).toLowerCase();
        if (text === "true" || text === "1") return true;
        if (text === "false" || text === "0") return false;
        return true;
    }

    private normalizePropertyMap(value: unknown): Record<string, unknown> {
        const properties: Record<string, unknown> = {};
        if (Array.isArray(value)) {
            for (const item of value) {
                const record = asRecord(item);
                if (!record) continue;
                const name = asText(firstValue(record, "propName", "name", "id"));
                if (name) properties[name] = firstValue(record, "value", "val");
            }
            return properties;
        }
        const record = asRecord(value);
        if (!record) return properties;
        const nested = record.properties ?? record.params ?? record;
        if (Array.isArray(nested)) return this.normalizePropertyMap(nested);
        const nestedRecord = asRecord(nested);
        return nestedRecord ? { ...nestedRecord } : properties;
    }

    private async paginatedRows(pathPrefix: string): Promise<Record<string, unknown>[]> {
        const rows: Record<string, unknown>[] = [];
        let page = 1;
        while (true) {
            const payload = await this.requestJson(
                "GET",
                `${pathPrefix}/${page}/${YEELIGHT_PRO_PAGE_SIZE}`,
            );
            const data = payload.data;
            const pageRows = listRows(data);
            rows.push(...pageRows);
            const total = asInt(asRecord(data)?.total);
            if (!pageRows.length || (total != null && rows.length >= total)) break;
            page += 1;
        }
        return rows;
    }

    private async requestJson(
        method: string,
        path: string,
        body?: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        if (!this.accessToken) throw new YeelightProCloudError("缺少易来云访问令牌", true);
        const headers: Record<string, string> = {
            accept: "application/json",
            authorization: `Bearer ${this.accessToken}`,
        };
        if (this.clientId) headers.clientId = this.clientId;
        if (body) headers["content-type"] = "application/json";
        let response: Response;
        try {
            response = await fetch(`${yeelightIotBaseUrl(this.region)}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(YEELIGHT_PRO_HTTP_TIMEOUT_MS),
            });
        } catch (error) {
            throw new YeelightProCloudError(
                `连接易来云失败：${error instanceof Error ? error.message : error}`,
            );
        }
        const payload = await readJson(response);
        if (response.status === 401) {
            throw new YeelightProCloudError("易来账号授权已失效", true, response.status);
        }
        if (response.status === 403) {
            throw new YeelightProCloudError("易来云拒绝了当前授权", true, response.status);
        }
        if (!response.ok) {
            throw new YeelightProCloudError(
                asText(payload.msg) ||
                    asText(payload.message) ||
                    `易来云请求失败（${response.status}）`,
                false,
                response.status,
            );
        }
        raiseForBody(payload);
        return payload;
    }
}

export function buildYeelightQrcodeContent(device: string, qrCodeId: string): string {
    return yeelightQrcodeContent(device, qrCodeId);
}
