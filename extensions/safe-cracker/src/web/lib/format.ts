/**
 * 倒计时展示：`mm:ss`，超过一小时才带上小时位。
 *
 * 传 `null` 表示还不知道剩余时间（没开局 / 拿不到结束时间）。
 */
export function formatClock(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "--:--";

    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number) => String(value).padStart(2, "0");

    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`;
}

/** 耗时展示：「1 分 23 秒」。未破解的传 null，显示占位符。 */
export function formatElapsed(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "—";

    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}
