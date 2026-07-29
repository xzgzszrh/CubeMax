import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    type AttemptPayload,
    type AttemptResult,
    type BoardView,
    GameStatus,
    type SelectableDevice,
    type StartGamePayload,
    type StudentView,
    type TeacherGameView,
} from "../../shared/contract";
import { apiHttpClient } from "./base";

export type { TeacherGameView };

/**
 * 轮询间隔。课堂上的一局通常只有几分钟，2 秒足够让老师、大屏、学生端看起来
 * 是同步的，又不至于把接口打爆。
 */
export const POLL_INTERVAL_MS = 2000;

export const gameQueryKeys = {
    devices: ["safe-cracker", "devices"] as const,
    current: ["safe-cracker", "current"] as const,
    mine: ["safe-cracker", "mine"] as const,
    board: ["safe-cracker", "board"] as const,
};

/** 老师侧：可选设备列表（含 MCP 接入状态与占用情况）。 */
export function useDevicesQuery() {
    return useQuery({
        queryKey: gameQueryKeys.devices,
        queryFn: () => apiHttpClient.get<SelectableDevice[]>("/game/devices"),
    });
}

/**
 * 老师侧：当前这一局。
 *
 * 只在进行中才轮询 —— 没开始的时候老师停在配置页，反复请求没有意义。
 */
export function useCurrentGameQuery() {
    return useQuery({
        queryKey: gameQueryKeys.current,
        queryFn: () => apiHttpClient.get<TeacherGameView>("/game/current"),
        refetchInterval: (query) =>
            query.state.data?.session?.status === GameStatus.RUNNING ? POLL_INTERVAL_MS : false,
    });
}

export function useStartGameMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: StartGamePayload) =>
            apiHttpClient.post<TeacherGameView, StartGamePayload>("/game", payload),
        onSuccess: (data) => {
            // 开始接口本身就返回完整视图，直接落盘可以省掉一次「配置页闪一下」。
            queryClient.setQueryData(gameQueryKeys.current, data);
            void queryClient.invalidateQueries({ queryKey: gameQueryKeys.devices });
        },
    });
}

export function useEndGameMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (sessionId: string) => apiHttpClient.post<unknown>(`/game/${sessionId}/end`),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: gameQueryKeys.current });
            // 结束后设备会被释放，占用状态需要重新拉。
            void queryClient.invalidateQueries({ queryKey: gameQueryKeys.devices });
        },
    });
}

/** 学生侧：我这一局的状态。学生端要一直轮询，才能等到老师开局。 */
export function useStudentGameQuery() {
    return useQuery({
        queryKey: gameQueryKeys.mine,
        queryFn: () => apiHttpClient.get<StudentView>("/game/mine"),
        refetchInterval: POLL_INTERVAL_MS,
    });
}

export function useAttemptMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: AttemptPayload) =>
            apiHttpClient.post<AttemptResult, AttemptPayload>("/game/mine/attempt", payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: gameQueryKeys.mine });
        },
    });
}

/** 大屏侧：排行榜。同样要一直轮询，等老师开局。 */
export function useBoardQuery() {
    return useQuery({
        queryKey: gameQueryKeys.board,
        queryFn: () => apiHttpClient.get<BoardView>("/game/board"),
        refetchInterval: POLL_INTERVAL_MS,
    });
}
