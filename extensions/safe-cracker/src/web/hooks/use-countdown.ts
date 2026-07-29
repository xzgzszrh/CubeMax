import { useEffect, useRef, useState } from "react";

function remainingFrom(endsAt: string | null | undefined, offsetMs: number): number | null {
    if (!endsAt) return null;

    const end = Date.parse(endsAt);
    if (Number.isNaN(end)) return null;

    return Math.max(0, end - (Date.now() + offsetMs));
}

/**
 * 倒计时，可选地用服务端时间校正本地时钟。
 *
 * 教室大屏那台电脑的系统时间经常差好几分钟，直接拿 `Date.now()` 和 `endsAt` 相减
 * 会让倒计时整体偏移。传入响应里的 `serverTime` 后，这里先算一次「服务端 - 本地」
 * 的偏移量，之后每次 tick 都带上，既不用每秒请求，也不会跟着本地时钟跑偏。
 *
 * @returns 剩余毫秒数；无法确定时返回 `null`。
 */
export function useCountdown(
    endsAt: string | null | undefined,
    serverTime?: string | null,
): number | null {
    const offsetRef = useRef(0);
    const [remainingMs, setRemainingMs] = useState<number | null>(() => remainingFrom(endsAt, 0));

    useEffect(() => {
        if (!serverTime) return;

        const parsed = Date.parse(serverTime);
        if (!Number.isNaN(parsed)) {
            offsetRef.current = parsed - Date.now();
        }
    }, [serverTime]);

    useEffect(() => {
        const tick = () => setRemainingMs(remainingFrom(endsAt, offsetRef.current));

        tick();
        // 500ms 而不是 1s：整秒跳变时不会因为对不齐而看起来卡一下。
        const timer = window.setInterval(tick, 500);
        return () => window.clearInterval(timer);
    }, [endsAt, serverTime]);

    return remainingMs;
}
