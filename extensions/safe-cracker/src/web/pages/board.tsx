import { useDocumentHead } from "@buildingai/hooks";
import { Cat, Keyboard, Lock, Trophy } from "lucide-react";

import {
    GameStatus,
    type LeaderboardEntry,
    ParticipantStatus,
    SolveVia,
} from "../../shared/contract";
import { useCountdown } from "../hooks/use-countdown";
import { formatClock, formatElapsed } from "../lib/format";
import { useBoardQuery } from "../services";

/** 名次配色：金银铜，投影上一眼就能认出前三。 */
const RANK_STYLES: Record<number, string> = {
    1: "bg-amber-400 text-slate-950",
    2: "bg-slate-300 text-slate-950",
    3: "bg-amber-700 text-white",
};

/**
 * 排行榜排序：已破解的按耗时升序在前，未破解的按尝试次数多的在前。
 *
 * 后端一般已经排好了，这里再排一次是为了大屏不依赖任何一端的顺序 ——
 * 投影上排错名次是很尴尬的事。
 */
function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return [...entries].sort((left, right) => {
        const leftSolved = left.status === ParticipantStatus.SOLVED;
        const rightSolved = right.status === ParticipantStatus.SOLVED;
        if (leftSolved !== rightSolved) return leftSolved ? -1 : 1;
        if (leftSolved && rightSolved) {
            return (left.elapsedMs ?? 0) - (right.elapsedMs ?? 0);
        }
        if (left.attempts !== right.attempts) return right.attempts - left.attempts;
        return left.agentName.localeCompare(right.agentName, "zh-Hans-CN");
    });
}

function ViaTag({ via }: { via: LeaderboardEntry["solvedVia"] }) {
    if (via === SolveVia.DEVICE) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-1 text-sm font-medium text-sky-300">
                <Cat className="size-4" />
                设备上报
            </span>
        );
    }

    if (via === SolveVia.STUDENT) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-1 text-sm font-medium text-violet-300">
                <Keyboard className="size-4" />
                学生输入
            </span>
        );
    }

    return null;
}

export default function BoardPage() {
    useDocumentHead({ title: "破解保险箱 · 大屏" });

    const { data: board } = useBoardQuery();
    const session = board?.session ?? null;
    // 教室大屏的系统时间经常不准，倒计时一律以服务端时间为准。
    const remainingMs = useCountdown(session?.endsAt, board?.serverTime);

    const entries = sortEntries(board?.entries ?? []);
    const isRunning = session?.status === GameStatus.RUNNING;
    const solvedCount = session?.solvedCount ?? 0;
    const totalCount = session?.participantCount ?? 0;
    const progress = totalCount > 0 ? (solvedCount / totalCount) * 100 : 0;

    if (!session) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-slate-950 text-white">
                <Lock className="size-24 text-slate-700" />
                <h1 className="text-6xl font-black tracking-tight">破解保险箱</h1>
                <p className="text-3xl text-slate-400">等待老师开始这一局…</p>
            </div>
        );
    }

    // 人一多就要缩排版，否则 40 个人的班级根本放不下。
    const density = entries.length <= 8 ? "loose" : entries.length <= 18 ? "normal" : "tight";
    const gridClass =
        density === "loose"
            ? "grid-cols-1"
            : density === "normal"
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
    const nameClass =
        density === "loose" ? "text-4xl" : density === "normal" ? "text-3xl" : "text-2xl";
    const rowPadding =
        density === "loose" ? "px-6 py-5" : density === "normal" ? "px-5 py-4" : "px-4 py-3";

    return (
        <div className="min-h-dvh bg-slate-950 px-8 py-8 text-white">
            <header className="flex flex-wrap items-end justify-between gap-6 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-5xl font-black tracking-tight">{session.title}</h1>
                    <p className="mt-2 text-2xl text-slate-400">
                        {isRunning ? "破解进行中" : "本局已结束"}
                    </p>
                </div>

                <div className="flex items-end gap-12">
                    <div className="text-right">
                        <div className="text-xl text-slate-400">已破解</div>
                        <div className="mt-1 text-6xl leading-none font-black tabular-nums">
                            <span className="text-emerald-400">{solvedCount}</span>
                            <span className="text-slate-600"> / {totalCount}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl text-slate-400">剩余时间</div>
                        <div
                            data-urgent={
                                isRunning && remainingMs !== null && remainingMs < 60_000
                                    ? true
                                    : undefined
                            }
                            className="mt-1 font-mono text-7xl leading-none font-black tabular-nums data-[urgent=true]:text-red-500"
                        >
                            {isRunning ? formatClock(remainingMs) : "00:00"}
                        </div>
                    </div>
                </div>
            </header>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className={`mt-8 grid gap-3 ${gridClass}`}>
                {entries.map((entry, index) => {
                    const solved = entry.status === ParticipantStatus.SOLVED;
                    const rank = solved ? (entry.rank ?? index + 1) : null;

                    return (
                        <div
                            key={`${entry.agentName}-${entry.studentName ?? ""}-${index}`}
                            data-solved={solved || undefined}
                            className={`flex items-center gap-5 rounded-2xl border border-slate-800 bg-slate-900/60 data-[solved=true]:border-emerald-500/40 data-[solved=true]:bg-emerald-500/10 ${rowPadding}`}
                        >
                            <div
                                className={`flex size-14 shrink-0 items-center justify-center rounded-xl text-2xl font-black tabular-nums ${
                                    rank && RANK_STYLES[rank]
                                        ? RANK_STYLES[rank]
                                        : solved
                                          ? "bg-emerald-500/20 text-emerald-300"
                                          : "bg-slate-800 text-slate-500"
                                }`}
                            >
                                {rank ? (
                                    rank <= 3 ? (
                                        <Trophy className="size-7" />
                                    ) : (
                                        rank
                                    )
                                ) : (
                                    <Lock className="size-6" />
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className={`truncate font-bold ${nameClass}`}>
                                    {entry.studentName || entry.agentName}
                                </div>
                                <div className="mt-1 flex items-center gap-2 truncate text-lg text-slate-400">
                                    {entry.studentName ? entry.agentName : "未绑定学生"}
                                    {!solved && <span>· 尝试 {entry.attempts} 次</span>}
                                </div>
                            </div>

                            <div className="shrink-0 text-right">
                                {solved ? (
                                    <>
                                        <div className="font-mono text-3xl font-black text-emerald-300 tabular-nums">
                                            {formatElapsed(entry.elapsedMs)}
                                        </div>
                                        <div className="mt-1">
                                            <ViaTag via={entry.solvedVia} />
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-2xl font-bold text-slate-600">破解中</div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {entries.length === 0 && (
                    <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-16 text-center text-3xl text-slate-500">
                        这一局还没有参与设备
                    </div>
                )}
            </div>
        </div>
    );
}
