import { useAuthStore } from "@buildingai/stores";
import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient, generateWebApiBase } from "../base";

const WORKFLOWS_PATH = "/workflows";
const WORKFLOWS_QUERY_KEY = ["workflows"] as const;

// ─────────────────────────────────────────────
// Run single node
// ─────────────────────────────────────────────

export interface RunSingleNodeParams {
    /** workflow id */
    workflow: string;
    /** node id */
    node: string;
}

export interface RunSingleNodeRequest {
    /** 用户在对话框中填写的测试值 */
    inputValues: Record<string, any>;
}

export interface RunSingleNodeResult {
    success: boolean;
    output: Record<string, any>;
    executionTime?: number;
    error?: string;
}

export function useRunSingleNodeMutation(params: RunSingleNodeParams) {
    return useMutation<RunSingleNodeResult, Error, RunSingleNodeRequest>({
        mutationFn: (body) =>
            apiHttpClient.post<RunSingleNodeResult>(
                `/node/${params.workflow}/${params.node}/test`,
                body,
            ),
    });
}

export function runSingleNodeApi(
    workflowId: string,
    nodeId: string,
    inputParams: Record<string, any>,
): Promise<RunSingleNodeResult> {
    return apiHttpClient.post<RunSingleNodeResult>(
        `/node/${workflowId}/${nodeId}/test`,
        inputParams,
    );
}

// ─────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────

export interface WorkflowNodeDto {
    nodeId: string;
    nodeType: string;
    nodeName: string;
    description?: string;
    config: Record<string, unknown>;
    position: { x: number; y: number };
    parentId?: string;
    extent?: "parent" | null;
    width?: number;
    height?: number;
}

export interface WorkflowEdgeDto {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

export interface WorkflowItem {
    id: string;
    name: string;
    description?: string | null;
    schema?: Record<string, unknown> | null;
    createBy: string;
    createdAt: string;
    updatedAt: string;
}

// ─────────────────────────────────────────────
// List workflows
// ─────────────────────────────────────────────

export interface ListWorkflowsParams {
    page?: number;
    pageSize?: number;
    keyword?: string;
}

export interface ListWorkflowsResult {
    items: WorkflowItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export const workflowQueryKeys = {
    all: WORKFLOWS_QUERY_KEY,
    listRoot: () => [...WORKFLOWS_QUERY_KEY, "list"] as const,
    list: (params?: ListWorkflowsParams) => [...WORKFLOWS_QUERY_KEY, "list", params] as const,
    detail: (id: string | undefined) => [...WORKFLOWS_QUERY_KEY, "detail", id] as const,
};

export function listWorkflows(params?: ListWorkflowsParams): Promise<ListWorkflowsResult> {
    return apiHttpClient.get<ListWorkflowsResult>(WORKFLOWS_PATH, { params });
}

export function useWorkflowListQuery(
    params?: ListWorkflowsParams,
    options?: QueryOptionsUtil<ListWorkflowsResult>,
) {
    return useQuery<ListWorkflowsResult>({
        queryKey: workflowQueryKeys.list(params),
        queryFn: () => listWorkflows(params),
        ...options,
    });
}

// ─────────────────────────────────────────────
// Workflow detail
// ─────────────────────────────────────────────

export function getWorkflowDetail(id: string): Promise<WorkflowItem> {
    return apiHttpClient.get<WorkflowItem>(`${WORKFLOWS_PATH}/${id}`);
}

export function useWorkflowDetailQuery(
    id: string | undefined,
    options?: QueryOptionsUtil<WorkflowItem>,
) {
    return useQuery<WorkflowItem>({
        queryKey: workflowQueryKeys.detail(id),
        queryFn: () => getWorkflowDetail(id!),
        enabled: !!id,
        ...options,
    });
}

// ─────────────────────────────────────────────
// Create workflow
// ─────────────────────────────────────────────

export interface CreateWorkflowDto {
    name: string;
    description?: string;
    schema?: Record<string, unknown>;
}

export function createWorkflow(dto: CreateWorkflowDto): Promise<WorkflowItem> {
    return apiHttpClient.post<WorkflowItem>(WORKFLOWS_PATH, dto);
}

export function useCreateWorkflowMutation(
    options?: MutationOptionsUtil<WorkflowItem, CreateWorkflowDto>,
) {
    const queryClient = useQueryClient();

    return useMutation<WorkflowItem, Error, CreateWorkflowDto>({
        mutationFn: createWorkflow,
        onSuccess: async (...args) => {
            await queryClient.invalidateQueries({ queryKey: workflowQueryKeys.listRoot() });
            options?.onSuccess?.(...args);
        },
        ...options,
    });
}

// ─────────────────────────────────────────────
// Update workflow
// ─────────────────────────────────────────────

export interface UpdateWorkflowDto {
    name?: string;
    description?: string;
    schema?: Record<string, unknown>;
}

export function updateWorkflow(id: string, dto: UpdateWorkflowDto): Promise<WorkflowItem> {
    return apiHttpClient.patch<WorkflowItem>(`${WORKFLOWS_PATH}/${id}`, dto);
}

export function useUpdateWorkflowMutation(
    options?: MutationOptionsUtil<WorkflowItem, { id: string; dto: UpdateWorkflowDto }>,
) {
    const queryClient = useQueryClient();

    return useMutation<WorkflowItem, Error, { id: string; dto: UpdateWorkflowDto }>({
        mutationFn: ({ id, dto }) => updateWorkflow(id, dto),
        onSuccess: async (...args) => {
            const [workflow, variables] = args;
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: workflowQueryKeys.listRoot() }),
                queryClient.invalidateQueries({ queryKey: workflowQueryKeys.detail(variables.id) }),
            ]);
            queryClient.setQueryData(workflowQueryKeys.detail(workflow.id), workflow);
            options?.onSuccess?.(...args);
        },
        ...options,
    });
}

// ─────────────────────────────────────────────
// Delete workflow
// ─────────────────────────────────────────────

export function deleteWorkflow(id: string): Promise<null> {
    return apiHttpClient.delete<null>(`${WORKFLOWS_PATH}/${id}`);
}

export function useDeleteWorkflowMutation(options?: MutationOptionsUtil<null, string>) {
    const queryClient = useQueryClient();

    return useMutation<null, Error, string>({
        mutationFn: deleteWorkflow,
        onSuccess: async (...args) => {
            await queryClient.invalidateQueries({ queryKey: workflowQueryKeys.listRoot() });
            options?.onSuccess?.(...args);
        },
        ...options,
    });
}

// ─────────────────────────────────────────────
// Save workflow nodes
// ─────────────────────────────────────────────

export interface SaveNodeDto {
    nodeId: string;
    nodeType: string;
    nodeName: string;
    description?: string;
    config: Record<string, unknown>;
    position: { x: number; y: number };
    parentId?: string;
    extent?: "parent" | null;
    width?: number;
    height?: number;
}

export interface SaveEdgeDto {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
}

export interface SaveWorkflowNodesDto {
    nodes: SaveNodeDto[];
    edges: SaveEdgeDto[];
}

export function useSaveWorkflowNodesMutation(
    workflowId?: string,
    options?: MutationOptionsUtil<WorkflowItem, SaveWorkflowNodesDto>,
) {
    return useMutation<WorkflowItem, Error, SaveWorkflowNodesDto>({
        mutationFn: (dto) =>
            updateWorkflow(workflowId!, {
                schema: {
                    nodes: dto.nodes,
                    edges: dto.edges,
                },
            }),
        ...options,
    });
}

// ─────────────────────────────────────────────
// SSE helper
// ─────────────────────────────────────────────

interface ConnectWebApiSSEParams {
    path: string;
    method: "GET" | "POST";
    onData: (data: string) => void;
    body?: unknown;
    onError?: (error: Error) => void;
    onClose?: () => void;
}

function connectWebApiSSE(params: ConnectWebApiSSEParams): { close(): void } {
    const controller = new AbortController();
    const url = generateWebApiBase() + params.path;
    const token = useAuthStore.getState().auth.token;

    const request = async () => {
        try {
            const response = await fetch(url, {
                method: params.method,
                headers: {
                    Accept: "text/event-stream",
                    ...(params.method === "POST" ? { "Content-Type": "application/json" } : {}),
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                params.onError?.(new Error(`SSE connection failed: ${response.statusText}`));
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    params.onClose?.();
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (line.startsWith("data:")) {
                        const data = line.slice(5).trim();
                        if (data) params.onData(data);
                    }
                }
            }
        } catch (err) {
            if ((err as { name?: string }).name !== "AbortError") {
                params.onError?.(err instanceof Error ? err : new Error(String(err)));
            }
        }
    };

    request();

    return { close: () => controller.abort() };
}

// ─────────────────────────────────────────────
// Run workflow (SSE)
// ─────────────────────────────────────────────

export interface RunWorkflowRequest {
    inputParams: Record<string, any>;
}

/** Content field of a streaming SSE event; null in the final terminal event */
export interface WorkflowRunNodeContent {
    nodeId: string;
    name: string;
    /** Node type code, e.g. "start", "end", "code", "iteration", "iteration_start", "iteration_end" */
    code: string;
    nodeStatus: "node_start" | "node_finished";
    /** Only present on node_finished */
    success?: boolean;
    /** Node output object (only present on node_finished) */
    output?: Record<string, any>;
}

/** Top-level shape of each SSE frame pushed by the backend */
export interface WorkflowRunSSEEvent {
    runId: string;
    status: "running" | "success" | "failed";
    startTime: string;
    endTime: string | null;
    /** Cumulative workflow execution time in ms */
    costTime: number;
    totalToken: number;
    error: string | null;
    context: Record<string, any>;
    /** null only in the final terminal event */
    content: WorkflowRunNodeContent | null;
}

/**
 * Start a workflow run and connect to its SSE stream in one step.
 * POSTs to the executeStream endpoint which both triggers execution and streams events.
 * Returns a handle whose `.close()` aborts the connection.
 */
export function connectWorkflowRunSSE(
    workflowId: string,
    request: RunWorkflowRequest | undefined,
    onEvent: (event: WorkflowRunSSEEvent) => void,
    onError?: (error: Error) => void,
    onClose?: () => void,
): { close(): void } {
    return connectWebApiSSE({
        path: `${WORKFLOWS_PATH}/${workflowId}/executeStream`,
        method: "POST",
        body: request,
        onError,
        onClose,
        onData: (data) => {
            if (data === "[DONE]") return;
            try {
                onEvent(JSON.parse(data) as WorkflowRunSSEEvent);
            } catch {
                // skip malformed frames
            }
        },
    });
}
