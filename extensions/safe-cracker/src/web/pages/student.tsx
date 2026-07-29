import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import {
    Cat,
    CircleCheckBig,
    CircleX,
    KeyRound,
    Lock,
    MessageCircle,
    Send,
    TimerOff,
} from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import {
    type AttemptResult,
    GameStatus,
    ParticipantStatus,
    type StudentView,
} from "../../shared/contract";
import { useCountdown } from "../hooks/use-countdown";
import { formatClock, formatElapsed } from "../lib/format";
import { useAttemptMutation, useStudentGameQuery } from "../services";

function Shell({ children }: { children: ReactNode }) {
    return (
        <div className="bg-background flex min-h-dvh items-center justify-center px-4 py-10">
            <div className="w-full max-w-md">{children}</div>
        </div>
    );
}

function EmptyState({
    icon,
    title,
    description,
}: {
    icon: ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="flex flex-col items-center gap-3 text-center">
            <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full [&>svg]:size-6">
                {icon}
            </div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        </div>
    );
}

function SolvedPanel({ mine }: { mine: StudentView }) {
    return (
        <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 [&>svg]:size-10">
                <CircleCheckBig />
            </div>
            <h1 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                保险箱打开了！
            </h1>
            <p className="text-muted-foreground text-sm">
                {mine.agentName ? `你说服了 ${mine.agentName}` : "你成功套出了密码"}
            </p>
            <div className="bg-card grid w-full grid-cols-2 gap-px overflow-hidden rounded-xl border">
                <div className="px-4 py-4">
                    <div className="text-muted-foreground text-xs">耗时</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">
                        {formatElapsed(mine.elapsedMs)}
                    </div>
                </div>
                <div className="border-l px-4 py-4">
                    <div className="text-muted-foreground text-xs">尝试次数</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums">{mine.attempts}</div>
                </div>
            </div>
            <p className="text-muted-foreground text-xs">去大屏上看看你排第几名。</p>
        </div>
    );
}

export default function StudentPage() {
    useDocumentHead({ title: "破解保险箱" });

    const { data: mine, isLoading } = useStudentGameQuery();
    const attempt = useAttemptMutation();
    const [password, setPassword] = useState("");
    const [feedback, setFeedback] = useState<AttemptResult | null>(null);

    const session = mine?.session ?? null;
    const remainingMs = useCountdown(session?.endsAt, mine?.serverTime);
    const timeUp = remainingMs !== null && remainingMs <= 0;

    if (isLoading) {
        return (
            <Shell>
                <div className="flex justify-center">
                    <Spinner className="text-muted-foreground size-8" />
                </div>
            </Shell>
        );
    }

    if (!session || session.status === GameStatus.DRAFT) {
        return (
            <Shell>
                <EmptyState
                    icon={<Lock />}
                    title="还没有开始"
                    description="等老师开始「破解保险箱」，这个页面会自动刷新，你不用做任何事。"
                />
            </Shell>
        );
    }

    // 老师一按结束，学生的成功页就没了会很扫兴 —— 结束后仍然把战绩留在屏幕上。
    if (session.status === GameStatus.ENDED) {
        return (
            <Shell>
                {mine?.status === ParticipantStatus.SOLVED ? (
                    <SolvedPanel mine={mine} />
                ) : (
                    <EmptyState
                        icon={<TimerOff />}
                        title="本局已结束"
                        description={`这次没能撬开保险箱，一共试了 ${mine?.attempts ?? 0} 次。下一局再来。`}
                    />
                )}
            </Shell>
        );
    }

    if (!mine?.agentName) {
        return (
            <Shell>
                <EmptyState
                    icon={<Cat />}
                    title="没找到属于你的方糖猫"
                    description="这一局里没有分配给你的设备。跟老师说一声，让他把你的方糖猫加进来。"
                />
            </Shell>
        );
    }

    if (!mine.ready) {
        return (
            <Shell>
                <div className="flex flex-col items-center gap-3 text-center">
                    <Spinner className="text-muted-foreground size-8" />
                    <h1 className="text-xl font-semibold">正在布置任务…</h1>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        老师正在把密码交给 {mine.agentName}，马上就好。
                    </p>
                </div>
            </Shell>
        );
    }

    if (mine.status === ParticipantStatus.SOLVED) {
        return (
            <Shell>
                <SolvedPanel mine={mine} />
            </Shell>
        );
    }

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        const value = password.trim();
        if (!value || attempt.isPending) return;

        attempt.mutate(
            { password: value },
            {
                onSuccess: (result) => {
                    setFeedback(result);
                    if (result.correct) {
                        setPassword("");
                    }
                },
            },
        );
    };

    return (
        <Shell>
            <div className="space-y-6">
                <div className="text-center">
                    <p className="text-muted-foreground text-sm">{session.title}</p>
                    <div
                        data-urgent={timeUp || (remainingMs !== null && remainingMs < 60_000)}
                        className="mt-1 font-mono text-6xl font-bold tabular-nums data-[urgent=true]:text-red-500"
                    >
                        {formatClock(remainingMs)}
                    </div>
                    <p className="text-muted-foreground mt-2 flex items-center justify-center gap-1.5 text-sm">
                        <Cat className="size-4" />
                        你的方糖猫：
                        <span className="text-foreground font-medium">{mine.agentName}</span>
                    </p>
                </div>

                {timeUp ? (
                    <div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-4 py-8 text-center">
                        <TimerOff className="text-muted-foreground size-8" />
                        <p className="font-medium">时间到</p>
                        <p className="text-muted-foreground text-sm">
                            等老师结束这一局，看看大屏上的战绩吧。
                        </p>
                    </div>
                ) : session.allowStudentInput ? (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="flex gap-2">
                            <Input
                                value={password}
                                autoComplete="off"
                                autoCapitalize="off"
                                autoCorrect="off"
                                spellCheck={false}
                                placeholder="输入你问到的密码"
                                className="h-12 text-center font-mono text-xl tracking-[0.4em]"
                                onChange={(event) => {
                                    setPassword(event.target.value);
                                    setFeedback(null);
                                }}
                            />
                            <Button
                                type="submit"
                                size="lg"
                                className="h-12 px-5"
                                loading={attempt.isPending}
                                disabled={!password.trim()}
                            >
                                <Send />
                                提交
                            </Button>
                        </div>

                        {feedback && (
                            <div
                                data-correct={feedback.correct}
                                className="text-destructive flex items-center justify-center gap-1.5 text-sm data-[correct=true]:text-emerald-600 dark:data-[correct=true]:text-emerald-400"
                            >
                                {feedback.correct ? (
                                    <CircleCheckBig className="size-4" />
                                ) : (
                                    <CircleX className="size-4" />
                                )}
                                {feedback.message}
                            </div>
                        )}
                    </form>
                ) : (
                    <div className="bg-card flex flex-col items-center gap-2 rounded-xl border px-4 py-8 text-center">
                        <MessageCircle className="text-muted-foreground size-8" />
                        <p className="font-medium">请直接和你的方糖猫对话</p>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            这一局不用在这里输入密码。想办法让 {mine.agentName} 说出密码，
                            破解后它会自动上报。
                        </p>
                    </div>
                )}

                <div className="text-muted-foreground flex items-center justify-center gap-1 text-xs">
                    <KeyRound className="size-3.5" />
                    已尝试 {mine.attempts} 次
                </div>
            </div>
        </Shell>
    );
}
