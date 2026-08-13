import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

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

export interface SimulatorSession {
    id: string;
    name: string;
    board: { type: "esp32-devkit-v1"; name: string; voltage: 3.3 };
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

export const simulatorQueryKeys = {
    all: ["simulator"] as const,
    sessions: () => ["simulator", "sessions"] as const,
    session: (id: string | undefined) => ["simulator", "session", id] as const,
};

export function listSimulatorSessions(): Promise<SimulatorSession[]> {
    return apiHttpClient.get(SIMULATOR_PATH);
}

export function createSimulatorSession(name?: string): Promise<SimulatorSession> {
    return apiHttpClient.post(SIMULATOR_PATH, name ? { name } : {});
}

export function getSimulatorSession(id: string): Promise<SimulatorSession> {
    return apiHttpClient.get(`${SIMULATOR_PATH}/${id}`);
}

export function resetSimulatorSession(id: string): Promise<SimulatorSession> {
    return apiHttpClient.post(`${SIMULATOR_PATH}/${id}/reset`);
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

export function deleteSimulatorSession(id: string): Promise<void> {
    return apiHttpClient.delete(`${SIMULATOR_PATH}/${id}`);
}

export function useSimulatorSessionsQuery(options?: QueryOptionsUtil<SimulatorSession[]>) {
    return useQuery({
        queryKey: simulatorQueryKeys.sessions(),
        queryFn: listSimulatorSessions,
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
    options?: MutationOptionsUtil<SimulatorSession, string | undefined>,
) {
    return useSimulatorMutation(createSimulatorSession, options);
}

export function useResetSimulatorSessionMutation(
    options?: MutationOptionsUtil<SimulatorSession, string>,
) {
    return useSimulatorMutation(resetSimulatorSession, options);
}

export function useUpdateSimulatorInputMutation(
    options?: MutationOptionsUtil<SimulatorSession, { id: string; input: SimulatorInputDto }>,
) {
    return useSimulatorMutation(
        ({ id, input }) => updateSimulatorInput(id, input),
        options,
    );
}

export function useWriteSimulatorSerialMutation(
    options?: MutationOptionsUtil<SimulatorSession, { id: string; text: string }>,
) {
    return useSimulatorMutation(({ id, text }) => writeSimulatorSerial(id, text), options);
}

export function useDeleteSimulatorSessionMutation(
    options?: MutationOptionsUtil<void, string>,
) {
    return useSimulatorMutation(deleteSimulatorSession, options);
}
