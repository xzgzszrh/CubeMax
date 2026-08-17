import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import {
    createProjectSimulatorSession,
    listProjectSimulatorSessions,
} from "./programming-project";

const SIMULATOR_PATH = "/simulator/sessions";

export type SimulatorPinMode =
    | "input"
    | "output"
    | "input_pullup"
    | "input_pulldown"
    | "analog"
    | "pwm";

export interface SimulatorPinState {
    mode: SimulatorPinMode;
    digitalValue: boolean;
    analogValue: number;
    pwmDutyCycle: number;
    frequencyHz: number;
}

export interface SimulatorSerialEntry {
    id: number;
    direction: "input" | "output" | "system";
    text: string;
    createdAt: string;
}

export type SimulatorBoardType = "esp32-devkit-v1" | "cubecat-s3" | "cubecat-p4";

export interface SimulatorSession {
    id: string;
    projectId?: string;
    name: string;
    board: { type: SimulatorBoardType; name: string; voltage: 3.3 };
    revision: number;
    pins: Record<string, SimulatorPinState>;
    peripherals: {
        led: { pin: string; on: boolean };
        button: { pin: string; pressed: boolean };
        potentiometer: { pin: string; value: number; max: number };
        buzzer: { pin: string; active: boolean; frequencyHz: number };
        servo: { pin: string; angle: number };
    };
    i2cDevices: Array<{ address: number; name: string }>;
    serialLog: SimulatorSerialEntry[];
    createdAt: string;
    updatedAt: string;
}

export type SimulatorInputDto =
    | { type: "button"; pressed: boolean }
    | { type: "potentiometer"; value: number };

export type SimulatorOperation = {
    action: string;
    args: Record<string, unknown>;
};

export type CreateSimulatorSessionInput = {
    name?: string;
    boardType?: SimulatorBoardType;
};

export const simulatorQueryKeys = {
    all: ["simulator"] as const,
    sessions: () => ["simulator", "sessions"] as const,
    session: (id: string | undefined) => ["simulator", "session", id] as const,
};

export function listSimulatorSessions(projectId?: string): Promise<SimulatorSession[]> {
    return projectId ? listProjectSimulatorSessions(projectId) : apiHttpClient.get(SIMULATOR_PATH);
}

export function createSimulatorSession(
    input: CreateSimulatorSessionInput = {},
    projectId?: string,
): Promise<SimulatorSession> {
    return projectId
        ? createProjectSimulatorSession(projectId, input)
        : apiHttpClient.post(SIMULATOR_PATH, input);
}

export function getSimulatorSession(id: string): Promise<SimulatorSession> {
    return apiHttpClient.get(`${SIMULATOR_PATH}/${id}`);
}

export function resetSimulatorSession(id: string): Promise<SimulatorSession> {
    return apiHttpClient.post(`${SIMULATOR_PATH}/${id}/reset`);
}

export function updateSimulatorBoard(
    id: string,
    boardType: SimulatorBoardType,
): Promise<SimulatorSession> {
    return apiHttpClient.patch(`${SIMULATOR_PATH}/${id}/board`, { boardType });
}

export function updateSimulatorInput(
    id: string,
    input: SimulatorInputDto,
): Promise<SimulatorSession> {
    return apiHttpClient.patch(`${SIMULATOR_PATH}/${id}/input`, input);
}

export function writeSimulatorSerial(id: string, text: string): Promise<SimulatorSession> {
    return apiHttpClient.post(`${SIMULATOR_PATH}/${id}/serial`, { text });
}

export function applySimulatorOperations(
    id: string,
    operations: SimulatorOperation[],
): Promise<SimulatorSession> {
    return apiHttpClient.post(`${SIMULATOR_PATH}/${id}/operations`, { operations });
}

export function deleteSimulatorSession(id: string): Promise<void> {
    return apiHttpClient.delete(`${SIMULATOR_PATH}/${id}`);
}

export function useSimulatorSessionsQuery(options?: QueryOptionsUtil<SimulatorSession[]>) {
    return useQuery({
        queryKey: simulatorQueryKeys.sessions(),
        queryFn: () => listSimulatorSessions(),
        ...options,
    });
}

export function useProjectSimulatorSessionsQuery(
    projectId: string | undefined,
    options?: QueryOptionsUtil<SimulatorSession[]>,
) {
    return useQuery({
        queryKey: [...simulatorQueryKeys.sessions(), projectId],
        queryFn: () => listSimulatorSessions(projectId),
        enabled: !!projectId,
        ...options,
    });
}

export function useSimulatorSessionQuery(
    id: string | undefined,
    options?: QueryOptionsUtil<SimulatorSession>,
) {
    return useQuery({
        queryKey: simulatorQueryKeys.session(id),
        queryFn: () => getSimulatorSession(id!),
        enabled: !!id,
        ...options,
    });
}

function useSimulatorMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: MutationOptionsUtil<TData, TVariables>,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        ...options,
        onSuccess: async (...args) => {
            await queryClient.invalidateQueries({ queryKey: simulatorQueryKeys.all });
            options?.onSuccess?.(...args);
        },
    });
}

export function useCreateSimulatorSessionMutation(
    options?: MutationOptionsUtil<SimulatorSession, CreateSimulatorSessionInput | undefined>,
    projectId?: string,
) {
    return useSimulatorMutation((input) => createSimulatorSession(input, projectId), options);
}

export function useResetSimulatorSessionMutation(
    options?: MutationOptionsUtil<SimulatorSession, string>,
) {
    return useSimulatorMutation(resetSimulatorSession, options);
}

export function useUpdateSimulatorBoardMutation(
    options?: MutationOptionsUtil<SimulatorSession, { id: string; boardType: SimulatorBoardType }>,
) {
    return useSimulatorMutation(
        ({ id, boardType }) => updateSimulatorBoard(id, boardType),
        options,
    );
}

export function useUpdateSimulatorInputMutation(
    options?: MutationOptionsUtil<SimulatorSession, { id: string; input: SimulatorInputDto }>,
) {
    return useSimulatorMutation(({ id, input }) => updateSimulatorInput(id, input), options);
}

export function useWriteSimulatorSerialMutation(
    options?: MutationOptionsUtil<SimulatorSession, { id: string; text: string }>,
) {
    return useSimulatorMutation(({ id, text }) => writeSimulatorSerial(id, text), options);
}

export function useApplySimulatorOperationsMutation(
    options?: MutationOptionsUtil<
        SimulatorSession,
        { id: string; operations: SimulatorOperation[] }
    >,
) {
    return useSimulatorMutation(
        ({ id, operations }) => applySimulatorOperations(id, operations),
        options,
    );
}

export function useDeleteSimulatorSessionMutation(options?: MutationOptionsUtil<void, string>) {
    return useSimulatorMutation(deleteSimulatorSession, options);
}
