import type { XiaomiHomeCapability } from "@buildingai/db/entities";

export type XiaomiHomeOAuthToken = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
};

export type XiaomiHomeOAuthTokenWithExpiry = XiaomiHomeOAuthToken & {
    expires_ts: number;
};

export type XiaomiHomeLocalCredentials = {
    provider: "xiaomi_home";
    version: 1;
    cloudServer: string;
    clientId: string;
    deviceId: string;
    redirectUri: string;
    state: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
};

export type XiaomiHomeOAuthQuery = {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
};

export type XiaomiHomeRawHome = {
    id: string | number;
    uid?: string | number;
    name: string;
    dids?: string[];
    roomlist?: Array<{ id: string | number; name: string; dids?: string[] }>;
};

export type XiaomiHomeCloudDevice = {
    did: string;
    uid?: string | null;
    name: string;
    urn: string;
    model: string;
    connectType?: number | null;
    token?: string | null;
    online?: boolean;
    icon?: string | null;
    manufacturer?: string | null;
    homeId?: string | null;
    homeName?: string | null;
    roomId?: string | null;
    roomName?: string | null;
    metadata?: Record<string, unknown>;
};

export type XiaomiHomeInventory = {
    uid: string | null;
    homes: Array<{
        id: string;
        name: string;
        uid: string | null;
        roomInfo: Array<{ id: string; name: string; deviceCount: number }>;
    }>;
    devices: XiaomiHomeCloudDevice[];
};

export type XiaomiHomeSpec = {
    type: string;
    description?: string;
    services?: Array<{
        iid: number;
        type: string;
        description?: string;
        properties?: Array<{
            iid: number;
            type: string;
            description?: string;
            format?: string;
            access?: string[];
            unit?: string;
            "value-range"?: [number, number, number];
            "value-list"?: Array<{ value: string | number | boolean; description?: string }>;
            // A few cached/spec proxy responses use the Python-style spelling.
            value_range?: [number, number, number];
            value_list?: Array<{ value: string | number | boolean; description?: string }>;
        }>;
        actions?: Array<{
            iid: number;
            type: string;
            description?: string;
            in?: number[];
        }>;
    }>;
};

export type XiaomiHomeNormalizedSpec = {
    category: string;
    capabilities: XiaomiHomeCapability[];
};

export type XiaomiHomeDeviceFilters = {
    homeId?: string;
    roomId?: string;
    category?: string;
    keyword?: string;
};

export type XiaomiHomePropertyCommand = {
    siid: number;
    piid: number;
    value: unknown;
};

export type XiaomiHomeActionCommand = {
    siid: number;
    aiid: number;
    in?: unknown[];
};
