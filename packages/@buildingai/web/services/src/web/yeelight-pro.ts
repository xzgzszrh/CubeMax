import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

const YEELIGHT_PRO_PATH = "/smart-home/yeelight";

export type YeelightProRegion = "cn" | "sg" | "us" | "de";
export type YeelightProAccountStatus = "active" | "auth_error" | "sync_error";
export type YeelightProScanStatus = "CREATED" | "SCANNED" | "CONFIRM" | "LOGIN" | "EXPIRED";

export const YEELIGHT_PRO_REGIONS: Array<{ value: YeelightProRegion; label: string }> = [
    { value: "cn", label: "中国大陆" },
    { value: "sg", label: "新加坡" },
    { value: "us", label: "美国" },
    { value: "de", label: "欧洲" },
];

export type YeelightProHomeSummary = {
    id: string;
    name: string;
    roomCount: number;
    deviceCount: number;
};

export type YeelightProAccount = {
    id: string;
    label: string;
    region: YeelightProRegion;
    regionLabel: string;
    username: string | null;
    houseId: string | null;
    houseName: string | null;
    status: YeelightProAccountStatus;
    homes: YeelightProHomeSummary[];
    deviceCount: number;
    onlineDeviceCount: number;
    lastSyncAt: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
};

export type YeelightProCapability = {
    kind: "property";
    name: string;
    description: string;
    format: string;
    access: string[];
    unit?: string | null;
    valueRange?: { min: number; max: number; step: number } | null;
    valueList?: Array<{ value: string | number | boolean; description: string }> | null;
};

export type YeelightProDevice = {
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

export type YeelightProQrStart = {
    sessionId: string;
    region: YeelightProRegion;
    regionLabel: string;
    qrcodeContent: string;
    qrcodeDataUrl: string;
    status: YeelightProScanStatus;
    expiresAt: string;
};

export type YeelightProQrPoll = {
    sessionId: string;
    status: YeelightProScanStatus;
    qrcodeContent: string;
    expiresAt: string;
    account: YeelightProAccount | null;
    houses: Array<{ id: string; name: string }>;
};

export const yeelightProQueryKeys = {
    all: ["yeelight-pro"] as const,
    accounts: () => ["yeelight-pro", "accounts"] as const,
    devices: (filters?: Record<string, string>) => ["yeelight-pro", "devices", filters] as const,
    device: (deviceId: string | undefined) => ["yeelight-pro", "device", deviceId] as const,
};

export function listYeelightProAccounts(): Promise<YeelightProAccount[]> {
    return apiHttpClient.get(`${YEELIGHT_PRO_PATH}/accounts`);
}

export function startYeelightProQr(region: YeelightProRegion = "cn"): Promise<YeelightProQrStart> {
    return apiHttpClient.post(`${YEELIGHT_PRO_PATH}/qr/start`, { region });
}

export function pollYeelightProQr(sessionId: string): Promise<YeelightProQrPoll> {
    return apiHttpClient.get(`${YEELIGHT_PRO_PATH}/qr/${sessionId}`);
}

export function selectYeelightProHouse(
    accountId: string,
    houseId: string,
): Promise<YeelightProAccount> {
    return apiHttpClient.post(`${YEELIGHT_PRO_PATH}/accounts/${accountId}/house`, { houseId });
}

export function syncYeelightProAccount(accountId: string): Promise<YeelightProAccount> {
    return apiHttpClient.post(`${YEELIGHT_PRO_PATH}/accounts/${accountId}/sync`);
}

export function updateYeelightProAccount(
    accountId: string,
    label: string,
): Promise<YeelightProAccount> {
    return apiHttpClient.patch(`${YEELIGHT_PRO_PATH}/accounts/${accountId}`, { label });
}

export function removeYeelightProAccount(accountId: string): Promise<void> {
    return apiHttpClient.delete(`${YEELIGHT_PRO_PATH}/accounts/${accountId}`);
}

export function listYeelightProDevices(): Promise<YeelightProDevice[]> {
    return apiHttpClient.get(`${YEELIGHT_PRO_PATH}/devices`);
}

export function getYeelightProDevice(deviceId: string): Promise<YeelightProDevice> {
    return apiHttpClient.get(`${YEELIGHT_PRO_PATH}/devices/${deviceId}`);
}

export function refreshYeelightProDevice(deviceId: string): Promise<YeelightProDevice> {
    return apiHttpClient.post(`${YEELIGHT_PRO_PATH}/devices/${deviceId}/refresh`);
}

export function setYeelightProProperty(
    deviceId: string,
    command: { name: string; value: unknown },
): Promise<YeelightProDevice> {
    return apiHttpClient.post(`${YEELIGHT_PRO_PATH}/devices/${deviceId}/properties`, command);
}

export function setYeelightProLight(
    deviceId: string,
    properties: Record<string, unknown>,
    duration?: number,
): Promise<YeelightProDevice> {
    return apiHttpClient.post(`${YEELIGHT_PRO_PATH}/devices/${deviceId}/light`, {
        properties,
        duration,
    });
}

export function useYeelightProAccountsQuery(options?: QueryOptionsUtil<YeelightProAccount[]>) {
    return useQuery({
        queryKey: yeelightProQueryKeys.accounts(),
        queryFn: listYeelightProAccounts,
        ...options,
    });
}

export function useYeelightProDevicesQuery(options?: QueryOptionsUtil<YeelightProDevice[]>) {
    return useQuery({
        queryKey: yeelightProQueryKeys.devices(),
        queryFn: listYeelightProDevices,
        ...options,
    });
}

export function useYeelightProDeviceQuery(
    deviceId: string | undefined,
    options?: QueryOptionsUtil<YeelightProDevice>,
) {
    return useQuery({
        queryKey: yeelightProQueryKeys.device(deviceId),
        queryFn: () => getYeelightProDevice(deviceId!),
        enabled: Boolean(deviceId),
        ...options,
    });
}

function useYeelightProMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: MutationOptionsUtil<TData, TVariables>,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        ...options,
        onSuccess: async (...args) => {
            await queryClient.invalidateQueries({ queryKey: yeelightProQueryKeys.all });
            options?.onSuccess?.(...args);
        },
    });
}

export function useStartYeelightProQrMutation(
    options?: MutationOptionsUtil<YeelightProQrStart, YeelightProRegion | undefined>,
) {
    return useMutation({
        mutationFn: (region) => startYeelightProQr(region || "cn"),
        ...options,
    });
}

export function useSelectYeelightProHouseMutation(
    options?: MutationOptionsUtil<YeelightProAccount, { accountId: string; houseId: string }>,
) {
    return useYeelightProMutation(
        ({ accountId, houseId }) => selectYeelightProHouse(accountId, houseId),
        options,
    );
}

export function useSyncYeelightProAccountMutation(
    options?: MutationOptionsUtil<YeelightProAccount, string>,
) {
    return useYeelightProMutation(syncYeelightProAccount, options);
}

export function useUpdateYeelightProAccountMutation(
    options?: MutationOptionsUtil<YeelightProAccount, { accountId: string; label: string }>,
) {
    return useYeelightProMutation(
        ({ accountId, label }) => updateYeelightProAccount(accountId, label),
        options,
    );
}

export function useRemoveYeelightProAccountMutation(options?: MutationOptionsUtil<void, string>) {
    return useYeelightProMutation(removeYeelightProAccount, options);
}

export function useRefreshYeelightProDeviceMutation(
    options?: MutationOptionsUtil<YeelightProDevice, string>,
) {
    return useYeelightProMutation(refreshYeelightProDevice, options);
}

export function useSetYeelightProPropertyMutation(
    options?: MutationOptionsUtil<
        YeelightProDevice,
        { deviceId: string; command: { name: string; value: unknown } }
    >,
) {
    return useYeelightProMutation(
        ({ deviceId, command }) => setYeelightProProperty(deviceId, command),
        options,
    );
}
