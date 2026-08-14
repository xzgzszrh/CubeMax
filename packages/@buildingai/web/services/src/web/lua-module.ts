import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

const LUA_MODULES_PATH = "/lua-modules";

export type LuaModuleSchema = {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
};

export interface LuaModuleItem {
    id: string;
    name: string;
    description?: string | null;
    draftCode: string;
    publishedCode?: string | null;
    inputSchema: LuaModuleSchema;
    outputSchema: LuaModuleSchema;
    assistantMessages: LuaAssistantMessage[];
    testParams: Record<string, unknown>;
    publishedInputSchema?: LuaModuleSchema | null;
    publishedOutputSchema?: LuaModuleSchema | null;
    isPublished: boolean;
    publishedAt?: string | null;
    createBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface LuaModuleListResult {
    items: LuaModuleItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface LuaModuleDto {
    name: string;
    description?: string;
    draftCode: string;
    inputSchema: LuaModuleSchema;
    outputSchema: LuaModuleSchema;
    assistantMessages?: LuaAssistantMessage[];
    testParams?: Record<string, unknown>;
}

export type LuaAssistantMessage = {
    role: "user" | "assistant";
    content: string;
};

export interface GenerateLuaModuleDto {
    modelId: string;
    message: string;
    messages: LuaAssistantMessage[];
    current: {
        name: string;
        description: string;
        draftCode: string;
        inputSchema: LuaModuleSchema;
        outputSchema: LuaModuleSchema;
        testParams: Record<string, unknown>;
    };
}

export interface GeneratedLuaModule {
    reply: string;
    name: string;
    description: string;
    draftCode: string;
    inputSchema: LuaModuleSchema;
    outputSchema: LuaModuleSchema;
    testParams: Record<string, unknown>;
}

export const luaModuleQueryKeys = {
    all: ["lua-modules"] as const,
    list: () => ["lua-modules", "list"] as const,
    detail: (id: string | undefined) => ["lua-modules", "detail", id] as const,
};

export function listLuaModules(params?: { isPublished?: boolean }): Promise<LuaModuleListResult> {
    return apiHttpClient.get(LUA_MODULES_PATH, { params: { page: 1, pageSize: 100, ...params } });
}

export function getLuaModule(id: string): Promise<LuaModuleItem> {
    return apiHttpClient.get(`${LUA_MODULES_PATH}/${id}`);
}

export function useLuaModulesQuery(
    params?: { isPublished?: boolean },
    options?: QueryOptionsUtil<LuaModuleListResult>,
) {
    return useQuery({
        queryKey: [...luaModuleQueryKeys.list(), params],
        queryFn: () => listLuaModules(params),
        ...options,
    });
}

export function useLuaModuleQuery(
    id: string | undefined,
    options?: QueryOptionsUtil<LuaModuleItem>,
) {
    return useQuery({
        queryKey: luaModuleQueryKeys.detail(id),
        queryFn: () => getLuaModule(id!),
        enabled: !!id,
        ...options,
    });
}

function useLuaModuleMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: MutationOptionsUtil<TData, TVariables>,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        ...options,
        onSuccess: async (...args) => {
            await queryClient.invalidateQueries({ queryKey: luaModuleQueryKeys.all });
            options?.onSuccess?.(...args);
        },
    });
}

export function useCreateLuaModuleMutation(
    options?: MutationOptionsUtil<LuaModuleItem, LuaModuleDto>,
) {
    return useLuaModuleMutation((dto) => apiHttpClient.post(LUA_MODULES_PATH, dto), options);
}

export function useUpdateLuaModuleMutation(
    options?: MutationOptionsUtil<LuaModuleItem, { id: string; dto: Partial<LuaModuleDto> }>,
) {
    return useLuaModuleMutation(
        ({ id, dto }) => apiHttpClient.patch(`${LUA_MODULES_PATH}/${id}`, dto),
        options,
    );
}

export function usePublishLuaModuleMutation(options?: MutationOptionsUtil<LuaModuleItem, string>) {
    return useLuaModuleMutation(
        (id) => apiHttpClient.post(`${LUA_MODULES_PATH}/${id}/publish`),
        options,
    );
}

export function useUnpublishLuaModuleMutation(
    options?: MutationOptionsUtil<LuaModuleItem, string>,
) {
    return useLuaModuleMutation(
        (id) => apiHttpClient.post(`${LUA_MODULES_PATH}/${id}/unpublish`),
        options,
    );
}

export function useDeleteLuaModuleMutation(options?: MutationOptionsUtil<void, string>) {
    return useLuaModuleMutation((id) => apiHttpClient.delete(`${LUA_MODULES_PATH}/${id}`), options);
}

export function testLuaModule(
    id: string,
    params: Record<string, unknown>,
    code?: string,
    simulatorSessionId?: string,
): Promise<{ output: Record<string, unknown>; executionTime: number }> {
    return apiHttpClient.post(`${LUA_MODULES_PATH}/${id}/test`, {
        params,
        code,
        simulatorSessionId,
    });
}

export function generateLuaModule(dto: GenerateLuaModuleDto): Promise<GeneratedLuaModule> {
    return apiHttpClient.post(`${LUA_MODULES_PATH}/generate`, dto);
}
