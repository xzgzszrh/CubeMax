import type { YeelightProCapability, YeelightProRegion } from "@buildingai/db/entities";

export type YeelightProScanStatus = "CREATED" | "SCANNED" | "CONFIRM" | "LOGIN" | "EXPIRED";

export type YeelightProAccountToken = {
    accessToken: string;
    tokenType: string;
    refreshToken: string;
    expiresIn: number;
    userId: string | null;
    username: string;
    clientId: string;
    clientSecret: string;
    region: string;
    device: string;
};

export type YeelightProScanLoginQrCode = {
    qrCodeId: string;
    device: string;
    status: YeelightProScanStatus;
    expireAtMs: number | null;
    expireInMs: number | null;
    token: YeelightProAccountToken | null;
};

export type YeelightProHouse = {
    id: string;
    name: string;
};

export type YeelightProCloudDevice = {
    id: string;
    name: string;
    productId: number | null;
    model: string | null;
    icon: string | null;
    category: string;
    online: boolean;
    roomId: string | null;
    roomName: string | null;
    houseId: string | null;
    houseName: string | null;
    properties: Record<string, unknown>;
    metadata: Record<string, unknown>;
};

export type YeelightProInventory = {
    houses: YeelightProHouse[];
    rooms: Array<{ id: string; name: string }>;
    devices: YeelightProCloudDevice[];
};

export type YeelightProNormalizedLight = {
    category: string;
    capabilities: YeelightProCapability[];
};

export type YeelightProPublicAccount = {
    id: string;
    label: string;
    region: YeelightProRegion;
    regionLabel: string;
    username: string | null;
    houseId: string | null;
    houseName: string | null;
    status: string;
    homes: Array<{ id: string; name: string; roomCount: number; deviceCount: number }>;
    deviceCount: number;
    onlineDeviceCount: number;
    lastSyncAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type YeelightProPublicDevice = {
    id: string;
    provider: "yeelight";
    accountId: string;
    did: string;
    name: string;
    model: string | null;
    icon: string | null;
    category: string;
    categoryLabel: string;
    online: boolean;
    houseId: string | null;
    houseName: string | null;
    roomId: string | null;
    roomName: string | null;
    capabilities: YeelightProCapability[];
    state: Record<string, unknown>;
    metadata: Record<string, unknown>;
    lastStateAt: string | null;
    createdAt: string;
    updatedAt: string;
};
