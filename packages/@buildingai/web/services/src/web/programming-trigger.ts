import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

const PROGRAMMING_TRIGGERS_PATH = "/programming-triggers";

export type ProgrammingTriggerType = "form";

export type ProgrammingTriggerProject = {
    id: string;
    name: string;
    isPublished: boolean;
    runtimeTarget: "local" | "simulator" | "device";
    mainWorkflowId: string;
};

export type JsonSchema = {
    type?: string;
    title?: string;
    description?: string;
    default?: unknown;
    enum?: unknown[];
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    format?: string;
    [key: string]: unknown;
};

export interface ProgrammingTriggerItem {
    id: string;
    name: string;
    description?: string | null;
    projectId: string;
    triggerType: ProgrammingTriggerType;
    inputSchema: JsonSchema;
    isEnabled: boolean;
    isPinned: boolean;
    homeOrder: number;
    createBy: string;
    createdAt: string;
    updatedAt: string;
    project: ProgrammingTriggerProject;
}

export type ProgrammingTriggerListResult = {
    items: ProgrammingTriggerItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type CreateProgrammingTriggerDto = {
    name: string;
    description?: string;
    projectId: string;
    triggerType?: ProgrammingTriggerType;
    isEnabled?: boolean;
    isPinned?: boolean;
    homeOrder?: number;
};

export type UpdateProgrammingTriggerDto = Partial<
    Omit<CreateProgrammingTriggerDto, "projectId">
> & {
    projectId?: string;
};

export type ExecuteProgrammingTriggerResult = { taskID: string };

export const programmingTriggerQueryKeys = {
    all: ["programming-triggers"] as const,
    listRoot: () => ["programming-triggers", "list"] as const,
    list: (params?: Record<string, unknown>) => ["programming-triggers", "list", params] as const,
    detail: (id?: string) => ["programming-triggers", "detail", id] as const,
};

export function listProgrammingTriggers(params?: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    isPinned?: boolean;
    isEnabled?: boolean;
}): Promise<ProgrammingTriggerListResult> {
    return apiHttpClient.get(PROGRAMMING_TRIGGERS_PATH, { params });
}

export function getProgrammingTrigger(id: string): Promise<ProgrammingTriggerItem> {
    return apiHttpClient.get(`${PROGRAMMING_TRIGGERS_PATH}/${id}`);
}

export function createProgrammingTrigger(
    dto: CreateProgrammingTriggerDto,
): Promise<ProgrammingTriggerItem> {
    return apiHttpClient.post(PROGRAMMING_TRIGGERS_PATH, dto);
}

export function updateProgrammingTrigger(
    id: string,
    dto: UpdateProgrammingTriggerDto,
): Promise<ProgrammingTriggerItem> {
    return apiHttpClient.patch(`${PROGRAMMING_TRIGGERS_PATH}/${id}`, dto);
}

export function deleteProgrammingTrigger(id: string): Promise<void> {
    return apiHttpClient.delete(`${PROGRAMMING_TRIGGERS_PATH}/${id}`);
}

export function executeProgrammingTrigger(
    id: string,
    inputs: Record<string, unknown>,
): Promise<ExecuteProgrammingTriggerResult> {
    return apiHttpClient.post(`${PROGRAMMING_TRIGGERS_PATH}/${id}/execute`, { inputs });
}

export function useProgrammingTriggersQuery(
    params?: Parameters<typeof listProgrammingTriggers>[0],
    options?: QueryOptionsUtil<ProgrammingTriggerListResult>,
) {
    return useQuery({
        queryKey: programmingTriggerQueryKeys.list(params),
        queryFn: () => listProgrammingTriggers(params),
        ...options,
    });
}

export function useProgrammingTriggerQuery(
    id?: string,
    options?: QueryOptionsUtil<ProgrammingTriggerItem>,
) {
    return useQuery({
        queryKey: programmingTriggerQueryKeys.detail(id),
        queryFn: () => getProgrammingTrigger(id!),
        enabled: !!id,
        ...options,
    });
}

function useTriggerMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: MutationOptionsUtil<TData, TVariables>,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        ...options,
        onSuccess: async (...args) => {
            await queryClient.invalidateQueries({ queryKey: programmingTriggerQueryKeys.all });
            options?.onSuccess?.(...args);
        },
    });
}

export function useCreateProgrammingTriggerMutation(
    options?: MutationOptionsUtil<ProgrammingTriggerItem, CreateProgrammingTriggerDto>,
) {
    return useTriggerMutation(createProgrammingTrigger, options);
}

export function useUpdateProgrammingTriggerMutation(
    options?: MutationOptionsUtil<
        ProgrammingTriggerItem,
        { id: string; dto: UpdateProgrammingTriggerDto }
    >,
) {
    return useTriggerMutation(({ id, dto }) => updateProgrammingTrigger(id, dto), options);
}

export function useDeleteProgrammingTriggerMutation(options?: MutationOptionsUtil<void, string>) {
    return useTriggerMutation(deleteProgrammingTrigger, options);
}

export function useExecuteProgrammingTriggerMutation(
    options?: MutationOptionsUtil<
        ExecuteProgrammingTriggerResult,
        { id: string; inputs: Record<string, unknown> }
    >,
) {
    return useMutation({
        mutationFn: ({ id, inputs }) => executeProgrammingTrigger(id, inputs),
        ...options,
    });
}
