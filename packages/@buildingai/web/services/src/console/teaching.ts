import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { OrganizationRoleType } from "../web/organization";

export type ConsoleOrganization = {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    appWhitelistEnabled: boolean;
    ownerId: string;
    ownerName: string;
    createdAt: string;
    memberCount: number;
    agentCount: number;
    quotaBalance: number;
    quotaTotalGranted: number;
    quotaTotalAllocated: number;
};

export type ConsoleOrganizationMember = {
    id: string;
    userId: string;
    roles: OrganizationRoleType[];
    memberType: "managed" | "invited" | "owner";
    canLeave: boolean;
    createdAt: string;
    username: string;
    nickname: string;
    realName?: string;
    avatar?: string;
    power: number;
};

export type ConsoleOwnerCandidate = {
    id: string;
    username: string;
    nickname: string;
    realName?: string;
    avatar?: string;
};

export type ConsoleTeachingDevices = {
    accounts: Array<{
        id: string;
        label: string;
        status: "active" | "auth_error" | "sync_error";
        organizationId: string | null;
        organizationName: string;
        lastSyncAt: string | null;
        lastError: string | null;
        createdAt: string;
    }>;
    agents: Array<{
        id: string;
        name: string;
        xiaozhiAccountId: string;
        organizationId: string | null;
        organizationName: string;
        deviceCount: number;
        onlineDeviceCount: number;
        lastConnectedAt: string | null;
        assignedUserId: string | null;
        assignedUserName: string | null;
    }>;
};

type TeachingAssetBase = {
    id: string;
    name: string;
    updatedAt: string;
    organizationName: string;
    ownerName: string;
};

export type ConsoleTeachingAssets = {
    scenes: Array<TeachingAssetBase & { description: string }>;
    quickCommands: Array<TeachingAssetBase & { sceneId: string; targetCount: number }>;
    interactions: Array<TeachingAssetBase & { status: string; targetCount: number }>;
};

const TEACHING_KEY = ["console", "teaching"] as const;

export function useConsoleOrganizationsQuery(keyword?: string) {
    return useQuery<ConsoleOrganization[]>({
        queryKey: [...TEACHING_KEY, "organizations", keyword ?? ""],
        queryFn: () =>
            consoleHttpClient.get("/teaching/organizations", {
                params: { keyword: keyword || undefined },
            }),
    });
}

export function useConsoleCreateOrganizationMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<ConsoleOrganization, Error, { name: string; ownerId?: string }>({
        mutationFn: (data) => consoleHttpClient.post("/teaching/organizations", data),
        ...options,
        onSuccess: (...args: any[]) => {
            queryClient.invalidateQueries({ queryKey: TEACHING_KEY });
            options?.onSuccess?.(...args);
        },
    });
}

export function useConsoleUpdateOrganizationMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<
        ConsoleOrganization,
        Error,
        {
            organizationId: string;
            name?: string;
            isActive?: boolean;
            appWhitelistEnabled?: boolean;
        }
    >({
        mutationFn: ({ organizationId, ...payload }) =>
            consoleHttpClient.patch(`/teaching/organizations/${organizationId}`, payload),
        ...options,
        onSuccess: (...args: any[]) => {
            queryClient.invalidateQueries({ queryKey: TEACHING_KEY });
            options?.onSuccess?.(...args);
        },
    });
}

export function useConsoleOrganizationMembersQuery(
    organizationId: string | null,
    options?: { enabled?: boolean },
) {
    return useQuery<ConsoleOrganizationMember[]>({
        queryKey: [...TEACHING_KEY, "members", organizationId],
        queryFn: () =>
            consoleHttpClient.get(`/teaching/organizations/${organizationId}/members`),
        enabled: Boolean(organizationId) && options?.enabled !== false,
    });
}

export function useConsoleUpdateMemberRolesMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<
        ConsoleOrganizationMember,
        Error,
        { organizationId: string; memberId: string; roles: OrganizationRoleType[] }
    >({
        mutationFn: ({ organizationId, memberId, roles }) =>
            consoleHttpClient.patch(
                `/teaching/organizations/${organizationId}/members/${memberId}`,
                { roles },
            ),
        ...options,
        onSuccess: (...args: any[]) => {
            queryClient.invalidateQueries({ queryKey: TEACHING_KEY });
            options?.onSuccess?.(...args);
        },
    });
}

export function useConsoleRemoveMemberMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<
        { success: boolean },
        Error,
        { organizationId: string; memberId: string }
    >({
        mutationFn: ({ organizationId, memberId }) =>
            consoleHttpClient.delete(
                `/teaching/organizations/${organizationId}/members/${memberId}`,
            ),
        ...options,
        onSuccess: (...args: any[]) => {
            queryClient.invalidateQueries({ queryKey: TEACHING_KEY });
            options?.onSuccess?.(...args);
        },
    });
}

export function useConsoleOwnerCandidatesQuery(keyword: string, options?: { enabled?: boolean }) {
    return useQuery<ConsoleOwnerCandidate[]>({
        queryKey: [...TEACHING_KEY, "owner-candidates", keyword],
        queryFn: () =>
            consoleHttpClient.get("/teaching/owner-candidates", {
                params: { keyword: keyword || undefined },
            }),
        enabled: options?.enabled !== false,
    });
}

export function useConsoleTopupQuotaMutation(options?: any) {
    const queryClient = useQueryClient();
    return useMutation<
        { balance: number },
        Error,
        { organizationId: string; amount: number; remark?: string }
    >({
        mutationFn: ({ organizationId, ...payload }) =>
            consoleHttpClient.post(
                `/teaching/organizations/${organizationId}/quota/topup`,
                payload,
            ),
        ...options,
        onSuccess: (...args: any[]) => {
            queryClient.invalidateQueries({ queryKey: TEACHING_KEY });
            options?.onSuccess?.(...args);
        },
    });
}

export function useConsoleTeachingDevicesQuery(organizationId?: string) {
    return useQuery<ConsoleTeachingDevices>({
        queryKey: [...TEACHING_KEY, "devices", organizationId ?? ""],
        queryFn: () =>
            consoleHttpClient.get("/teaching/devices", {
                params: { organizationId: organizationId || undefined },
            }),
    });
}

export function useConsoleTeachingAssetsQuery(organizationId?: string) {
    return useQuery<ConsoleTeachingAssets>({
        queryKey: [...TEACHING_KEY, "assets", organizationId ?? ""],
        queryFn: () =>
            consoleHttpClient.get("/teaching/assets", {
                params: { organizationId: organizationId || undefined },
            }),
    });
}
