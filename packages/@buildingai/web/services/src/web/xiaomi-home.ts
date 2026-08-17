import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

const XIAOMI_HOME_PATH = "/smart-home/xiaomi";

export type XiaomiHomeServer = "cn" | "de" | "i2" | "ru" | "sg" | "us";
export type XiaomiHomeAccountStatus = "active" | "auth_error" | "sync_error";

export const XIAOMI_HOME_SERVERS: Array<{ value: XiaomiHomeServer; label: string }> = [
    { value: "cn", label: "中国大陆" },
    { value: "de", label: "欧洲" },
    { value: "i2", label: "印度" },
    { value: "ru", label: "俄罗斯" },
    { value: "sg", label: "新加坡" },
    { value: "us", label: "美国" },
];

export type XiaomiHomeSummary = {
    id: string;
    name: string;
    uid?: string | null;
    roomCount: number;
    deviceCount: number;
};

export type XiaomiHomeAccount = {
    id: string;
    label: string;
    cloudServer: XiaomiHomeServer;
    cloudServerLabel: string;
    upstreamUserId: string | null;
    nickname: string | null;
    status: XiaomiHomeAccountStatus;
    homes: XiaomiHomeSummary[];
    deviceCount: number;
    onlineDeviceCount: number;
    lastSyncAt: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
};

export type XiaomiHomeValueRange = { min: number; max: number; step: number };

export type XiaomiHomeCapability = {
    kind: "property" | "action";
    siid: number;
    piid?: number;
    aiid?: number;
    serviceName: string;
    serviceDescription?: string;
    name: string;
    description?: string;
    format?: string;
    access?: string[];
    unit?: string | null;
    valueRange?: XiaomiHomeValueRange | null;
    valueList?: Array<{ value: string | number | boolean; description: string }> | null;
    input?: Array<{
        piid: number;
        name: string;
        description?: string;
        format?: string;
        valueRange?: XiaomiHomeValueRange | null;
        valueList?: Array<{ value: string | number | boolean; description: string }> | null;
    }>;
};

export type XiaomiHomeDevice = {
    id: string;
    accountId: string;
    did: string;
    name: string;
    model: string | null;
    urn: string | null;
    manufacturer: string | null;
    icon: string | null;
    category: string;
    categoryLabel: string;
    online: boolean;
    connectType: number | null;
    homeId: string | null;
    homeName: string | null;
    roomId: string | null;
    roomName: string | null;
    capabilities: XiaomiHomeCapability[];
    state: Record<string, unknown>;
    metadata: Record<string, unknown>;
    lastStateAt: string | null;
    createdAt: string;
    updatedAt: string;
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

export type XiaomiHomeOAuthStart = {
    authorizationUrl: string;
    expiresAt: string;
    cloudServer: XiaomiHomeServer;
    redirectUri: string;
    state: string;
    mode: XiaomiHomeOAuthMode;
};

export type XiaomiHomeOAuthMode = "direct" | "local_token";
export type XiaomiHomeOAuthStartInput = {
    cloudServer?: XiaomiHomeServer;
    mode?: XiaomiHomeOAuthMode;
};

export type XiaomiHomeOAuthMessage = {
    type: "buildingai:xiaomi-home-oauth";
    success: boolean;
    accountId?: string;
    message: string;
};

export const xiaomiHomeQueryKeys = {
    all: ["xiaomi-home"] as const,
    accounts: () => ["xiaomi-home", "accounts"] as const,
    allDevices: (filters?: XiaomiHomeDeviceFilters) =>
        ["xiaomi-home", "devices", "all", filters] as const,
    devices: (accountId: string | undefined, filters?: XiaomiHomeDeviceFilters) =>
        ["xiaomi-home", "devices", accountId, filters] as const,
    device: (deviceId: string | undefined) => ["xiaomi-home", "device", deviceId] as const,
};

export function listXiaomiHomeAccounts(): Promise<XiaomiHomeAccount[]> {
    return apiHttpClient.get(`${XIAOMI_HOME_PATH}/accounts`);
}

export function startXiaomiHomeOAuth(
    input: XiaomiHomeOAuthStartInput = {},
): Promise<XiaomiHomeOAuthStart> {
    return apiHttpClient.post(`${XIAOMI_HOME_PATH}/oauth/start`, {
        cloudServer: input.cloudServer || "cn",
        mode: input.mode || "direct",
    });
}

export function importXiaomiHomeCredentials(credentials: string): Promise<XiaomiHomeAccount> {
    return apiHttpClient.post(`${XIAOMI_HOME_PATH}/import`, { credentials });
}

export function syncXiaomiHomeAccount(accountId: string): Promise<XiaomiHomeAccount> {
    return apiHttpClient.post(`${XIAOMI_HOME_PATH}/accounts/${accountId}/sync`);
}

export function updateXiaomiHomeAccount(
    accountId: string,
    label: string,
): Promise<XiaomiHomeAccount> {
    return apiHttpClient.patch(`${XIAOMI_HOME_PATH}/accounts/${accountId}`, { label });
}

export function removeXiaomiHomeAccount(accountId: string): Promise<void> {
    return apiHttpClient.delete(`${XIAOMI_HOME_PATH}/accounts/${accountId}`);
}

export function listXiaomiHomeDevices(
    accountId: string,
    filters?: XiaomiHomeDeviceFilters,
): Promise<XiaomiHomeDevice[]> {
    return apiHttpClient.get(`${XIAOMI_HOME_PATH}/accounts/${accountId}/devices`, {
        params: filters,
    });
}

export function listAllXiaomiHomeDevices(
    filters?: XiaomiHomeDeviceFilters,
): Promise<XiaomiHomeDevice[]> {
    return apiHttpClient.get(`${XIAOMI_HOME_PATH}/devices`, { params: filters });
}

export function getXiaomiHomeDevice(deviceId: string): Promise<XiaomiHomeDevice> {
    return apiHttpClient.get(`${XIAOMI_HOME_PATH}/devices/${deviceId}`);
}

export function refreshXiaomiHomeDevice(deviceId: string): Promise<XiaomiHomeDevice> {
    return apiHttpClient.post(`${XIAOMI_HOME_PATH}/devices/${deviceId}/refresh`);
}

export function setXiaomiHomeProperty(
    deviceId: string,
    command: XiaomiHomePropertyCommand,
): Promise<XiaomiHomeDevice> {
    return apiHttpClient.post(`${XIAOMI_HOME_PATH}/devices/${deviceId}/properties`, command);
}

export function executeXiaomiHomeAction(
    deviceId: string,
    command: XiaomiHomeActionCommand,
): Promise<{ success: boolean; result: Record<string, unknown> }> {
    return apiHttpClient.post(`${XIAOMI_HOME_PATH}/devices/${deviceId}/actions`, command);
}

export function useXiaomiHomeAccountsQuery(options?: QueryOptionsUtil<XiaomiHomeAccount[]>) {
    return useQuery({
        queryKey: xiaomiHomeQueryKeys.accounts(),
        queryFn: listXiaomiHomeAccounts,
        ...options,
    });
}

export function useXiaomiHomeDevicesQuery(
    accountId: string | undefined,
    filters?: XiaomiHomeDeviceFilters,
    options?: QueryOptionsUtil<XiaomiHomeDevice[]>,
) {
    return useQuery({
        queryKey: xiaomiHomeQueryKeys.devices(accountId, filters),
        queryFn: () => listXiaomiHomeDevices(accountId!, filters),
        enabled: Boolean(accountId),
        ...options,
    });
}

export function useAllXiaomiHomeDevicesQuery(
    filters?: XiaomiHomeDeviceFilters,
    options?: QueryOptionsUtil<XiaomiHomeDevice[]>,
) {
    return useQuery({
        queryKey: xiaomiHomeQueryKeys.allDevices(filters),
        queryFn: () => listAllXiaomiHomeDevices(filters),
        ...options,
    });
}

export function useXiaomiHomeDeviceQuery(
    deviceId: string | undefined,
    options?: QueryOptionsUtil<XiaomiHomeDevice>,
) {
    return useQuery({
        queryKey: xiaomiHomeQueryKeys.device(deviceId),
        queryFn: () => getXiaomiHomeDevice(deviceId!),
        enabled: Boolean(deviceId),
        ...options,
    });
}

function useXiaomiHomeMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: MutationOptionsUtil<TData, TVariables>,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        ...options,
        onSuccess: async (...args) => {
            await queryClient.invalidateQueries({ queryKey: xiaomiHomeQueryKeys.all });
            options?.onSuccess?.(...args);
        },
    });
}

export function useStartXiaomiHomeOAuthMutation(
    options?: MutationOptionsUtil<XiaomiHomeOAuthStart, XiaomiHomeOAuthStartInput | undefined>,
) {
    return useMutation({
        mutationFn: (input) => startXiaomiHomeOAuth(input),
        ...options,
    });
}

export function useImportXiaomiHomeCredentialsMutation(
    options?: MutationOptionsUtil<XiaomiHomeAccount, string>,
) {
    return useXiaomiHomeMutation(importXiaomiHomeCredentials, options);
}

export function useSyncXiaomiHomeAccountMutation(
    options?: MutationOptionsUtil<XiaomiHomeAccount, string>,
) {
    return useXiaomiHomeMutation(syncXiaomiHomeAccount, options);
}

export function useUpdateXiaomiHomeAccountMutation(
    options?: MutationOptionsUtil<XiaomiHomeAccount, { accountId: string; label: string }>,
) {
    return useXiaomiHomeMutation(
        ({ accountId, label }) => updateXiaomiHomeAccount(accountId, label),
        options,
    );
}

export function useRemoveXiaomiHomeAccountMutation(options?: MutationOptionsUtil<void, string>) {
    return useXiaomiHomeMutation(removeXiaomiHomeAccount, options);
}

export function useRefreshXiaomiHomeDeviceMutation(
    options?: MutationOptionsUtil<XiaomiHomeDevice, string>,
) {
    return useXiaomiHomeMutation(refreshXiaomiHomeDevice, options);
}

export function useSetXiaomiHomePropertyMutation(
    options?: MutationOptionsUtil<
        XiaomiHomeDevice,
        { deviceId: string; command: XiaomiHomePropertyCommand }
    >,
) {
    return useXiaomiHomeMutation(
        ({ deviceId, command }) => setXiaomiHomeProperty(deviceId, command),
        options,
    );
}

export function useExecuteXiaomiHomeActionMutation(
    options?: MutationOptionsUtil<
        { success: boolean; result: Record<string, unknown> },
        { deviceId: string; command: XiaomiHomeActionCommand }
    >,
) {
    return useXiaomiHomeMutation(
        ({ deviceId, command }) => executeXiaomiHomeAction(deviceId, command),
        options,
    );
}
