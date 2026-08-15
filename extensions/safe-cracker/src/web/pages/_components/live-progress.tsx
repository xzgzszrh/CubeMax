import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@buildingai/ui/components/ui/table";
import { Cat, CircleCheckBig, Eye, EyeOff, Keyboard, Square, TriangleAlert } from "lucide-react";
import { useState } from "react";

import {
    type GameSessionView,
    ParticipantStatus,
    type ParticipantView,
    PasswordMode,
    SolveVia,
} from "../../../shared/contract";
import { useCountdown } from "../../hooks/use-countdown";
import { formatClock, formatElapsed } from "../../lib/format";

type LiveProgressProps = {
    /** 服务器时间，用于校正倒计时 —— 教室里的电脑时钟常年不准。 */
    serverTime?: string;
    session: GameSessionView;
    participants: ParticipantView[];
    /** 已结束的一局只展示战绩，不再倒计时，也没有结束按钮。 */
    readOnly?: boolean;
    ending?: boolean;
    onEnd?: () => void;
};

function SolvedViaTag({ via }: { via: ParticipantView["solvedVia"] }) {
    if (via === SolveVia.DEVICE) {
        return (
            <Badge variant="secondary">
                <Cat />
                设备上报
            </Badge>
        );
    }

    if (via === SolveVia.STUDENT) {
        return (
            <Badge variant="secondary">
                <Keyboard />
                学生输入
            </Badge>
        );
    }

    return null;
}

export function LiveProgress({
    session,
    participants,
    readOnly,
    ending,
    serverTime,
    onEnd,
}: LiveProgressProps) {
    const [passwordVisible, setPasswordVisible] = useState(true);
    const remainingMs = useCountdown(readOnly ? null : session.endsAt, serverTime);
    const notReady = participants.filter((participant) => !participant.ready);

    const sorted = [...participants].sort((left, right) => {
        const leftSolved = left.status === ParticipantStatus.SOLVED;
        const rightSolved = right.status === ParticipantStatus.SOLVED;
        if (leftSolved !== rightSolved) return leftSolved ? -1 : 1;
        if (leftSolved && rightSolved) {
            return (left.elapsedMs ?? 0) - (right.elapsedMs ?? 0);
        }
        return left.agentName.localeCompare(right.agentName, "zh-Hans-CN");
    });

    return (
        <div className="space-y-4">
            <div className="bg-card flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">{session.title}</h2>
                        {readOnly ? <Badge variant="outline">已结束</Badge> : <Badge>进行中</Badge>}
                    </div>
                    <p className="text-muted-foreground text-sm">
                        已破解 {session.solvedCount} / 共 {session.participantCount} 台 ·{" "}
                        {session.passwordMode === PasswordMode.SHARED
                            ? "全班同一个密码"
                            : "每人不同密码"}{" "}
                        · {session.passwordLength} 位
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {!readOnly && (
                        <div className="text-right">
                            <div className="text-muted-foreground text-xs">剩余时间</div>
                            <div className="font-mono text-3xl leading-tight font-bold tabular-nums">
                                {formatClock(remainingMs)}
                            </div>
                        </div>
                    )}
                    {!readOnly && onEnd && (
                        <Button variant="destructive" loading={ending} onClick={onEnd}>
                            <Square />
                            结束游戏
                        </Button>
                    )}
                </div>
            </div>

            {notReady.length > 0 && (
                <Alert variant="destructive">
                    <TriangleAlert />
                    <AlertTitle>{notReady.length} 台设备没能收到任务</AlertTitle>
                    <AlertDescription>
                        <ul className="mt-1 space-y-1">
                            {notReady.map((participant) => (
                                <li key={participant.id}>
                                    <span className="font-medium">{participant.agentName}</span>
                                    {participant.studentName
                                        ? `（${participant.studentName}）`
                                        : ""}
                                    ：
                                    {participant.readyError || "提示词下发失败，请检查设备是否在线"}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-2">
                            这几位学生的方糖猫还不知道密码，跟他们说一声，或者结束后重开一局。
                        </p>
                    </AlertDescription>
                </Alert>
            )}

            <div className="bg-card overflow-hidden rounded-xl border">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                    <span className="text-sm font-medium">实时进度</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPasswordVisible((prev) => !prev)}
                    >
                        {passwordVisible ? <EyeOff /> : <Eye />}
                        {passwordVisible ? "隐藏密码" : "显示密码"}
                    </Button>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>方糖猫</TableHead>
                            <TableHead>学生</TableHead>
                            <TableHead>密码</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead className="text-right">尝试次数</TableHead>
                            <TableHead className="text-right">耗时</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.map((participant) => {
                            const solved = participant.status === ParticipantStatus.SOLVED;

                            return (
                                <TableRow key={participant.id}>
                                    <TableCell className="font-medium">
                                        <span className="flex items-center gap-1.5">
                                            {participant.agentName}
                                            {!participant.ready && (
                                                <TriangleAlert className="text-destructive size-3.5" />
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {participant.studentName || "—"}
                                    </TableCell>
                                    <TableCell className="font-mono tracking-widest">
                                        {passwordVisible
                                            ? (participant.password ?? "—")
                                            : "•".repeat(session.passwordLength)}
                                    </TableCell>
                                    <TableCell>
                                        {solved ? (
                                            <span className="flex flex-wrap items-center gap-1.5">
                                                <Badge className="bg-emerald-600 text-white">
                                                    <CircleCheckBig />
                                                    已破解
                                                </Badge>
                                                <SolvedViaTag via={participant.solvedVia} />
                                            </span>
                                        ) : participant.ready ? (
                                            <Badge variant="outline">破解中</Badge>
                                        ) : (
                                            <Badge variant="destructive">未就绪</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {participant.attempts}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatElapsed(participant.elapsedMs)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}

                        {sorted.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="text-muted-foreground py-10 text-center"
                                >
                                    这一局没有参与设备
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
