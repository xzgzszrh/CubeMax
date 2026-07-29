import { useDocumentHead } from "@buildingai/hooks";
import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { Button } from "@buildingai/ui/components/ui/button";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { ExternalLink, Info, MonitorPlay, Play, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { APP_IDENTIFIER, GameStatus } from "../../shared/contract";
import { getBoardUrl } from "../lib/host";
import {
    useCurrentGameQuery,
    useDevicesQuery,
    useEndGameMutation,
    useStartGameMutation,
} from "../services";
import { DevicePicker } from "./_components/device-picker";
import {
    DEFAULT_GAME_SETTINGS,
    GameSettings,
    type GameSettingsValue,
} from "./_components/game-settings";
import { LiveProgress } from "./_components/live-progress";

export default function TeacherPage() {
    useDocumentHead({ title: "破解保险箱 · 老师面板" });

    const { confirm } = useAlertDialog();
    const [settings, setSettings] = useState<GameSettingsValue>(DEFAULT_GAME_SETTINGS);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { data: devices = [], isLoading: devicesLoading } = useDevicesQuery();
    const { data: current, isLoading: currentLoading } = useCurrentGameQuery();
    const startGame = useStartGameMutation();
    const endGame = useEndGameMutation();

    const session = current?.session ?? null;
    const participants = current?.participants ?? [];
    const isRunning = session?.status === GameStatus.RUNNING;
    const isEnded = session?.status === GameStatus.ENDED;

    const selectedDevices = devices.filter((device) => selectedIds.includes(device.agentBindingId));
    // MCP 没接入的设备收不到工具，方糖猫破解后没法自己上报 —— 开始前必须让老师知道。
    const offlineSelected = selectedDevices.filter((device) => device.mcpConnected !== true);
    const noSubmitChannel = !settings.allowDeviceReport && !settings.allowStudentInput;

    const handleToggleDevice = (agentBindingId: string) => {
        setSelectedIds((prev) =>
            prev.includes(agentBindingId)
                ? prev.filter((id) => id !== agentBindingId)
                : [...prev, agentBindingId],
        );
    };

    const handleSelectAll = () => {
        setSelectedIds(
            devices.filter((device) => !device.busy).map((device) => device.agentBindingId),
        );
    };

    const handleStart = () => {
        if (selectedIds.length === 0) return;

        startGame.mutate({
            title: settings.title.trim() || DEFAULT_GAME_SETTINGS.title,
            agentBindingIds: selectedIds,
            promptTemplate: settings.promptTemplate,
            passwordMode: settings.passwordMode,
            passwordLength: settings.passwordLength,
            durationMinutes: settings.durationMinutes,
            allowDeviceReport: settings.allowDeviceReport,
            allowStudentInput: settings.allowStudentInput,
            enableStudentView: settings.enableStudentView,
            lockStudentEdits: settings.lockStudentEdits,
        });
    };

    const handleEnd = async () => {
        if (!session) return;

        try {
            await confirm({
                title: "结束这一局？",
                description: "结束后方糖猫会恢复原来的设定，还没破解的学生就没机会了。",
                confirmText: "结束游戏",
                confirmVariant: "destructive",
            });
        } catch {
            return;
        }

        endGame.mutate(session.id);
    };

    if (currentLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center">
                <Spinner className="text-muted-foreground size-8" />
            </div>
        );
    }

    return (
        <div className="bg-background min-h-dvh py-8">
            <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">破解保险箱</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            给每台方糖猫塞一个密码，让学生想办法把它套出来。
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <a href={getBoardUrl(APP_IDENTIFIER)} target="_blank" rel="noreferrer">
                            <MonitorPlay />
                            打开大屏
                            <ExternalLink />
                        </a>
                    </Button>
                </header>

                {session && (isRunning || isEnded) && (
                    <LiveProgress
                        session={session}
                        participants={participants}
                        readOnly={isEnded}
                        ending={endGame.isPending}
                        serverTime={current?.serverTime}
                        onEnd={handleEnd}
                    />
                )}

                {!isRunning && (
                    <div className="space-y-6">
                        {isEnded && (
                            <div className="text-muted-foreground border-t pt-6 text-sm font-medium">
                                再来一局
                            </div>
                        )}

                        <DevicePicker
                            devices={devices}
                            loading={devicesLoading}
                            selectedIds={selectedIds}
                            onToggle={handleToggleDevice}
                            onSelectAll={handleSelectAll}
                            onClear={() => setSelectedIds([])}
                        />

                        {offlineSelected.length > 0 && (
                            <Alert variant="destructive">
                                <TriangleAlert />
                                <AlertTitle>
                                    有 {offlineSelected.length} 台已选设备没接入 MCP
                                </AlertTitle>
                                <AlertDescription>
                                    <p>
                                        {offlineSelected.map((device) => device.name).join("、")}
                                        ：方糖猫收不到上报工具，破解后不会自动记录。
                                        {settings.allowStudentInput
                                            ? "这些学生只能在学生端手动输入密码。"
                                            : "建议打开「允许学生输入」，否则他们没法提交答案。"}
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}

                        {noSubmitChannel && (
                            <Alert variant="destructive">
                                <TriangleAlert />
                                <AlertTitle>没有任何提交渠道</AlertTitle>
                                <AlertDescription>
                                    「允许设备上报」和「允许学生输入」都关掉了，学生就算问出密码也无处提交。至少打开一个。
                                </AlertDescription>
                            </Alert>
                        )}

                        {!settings.enableStudentView && settings.allowStudentInput && (
                            <Alert>
                                <Info />
                                <AlertTitle>学生端已关闭</AlertTitle>
                                <AlertDescription>
                                    学生打不开学生端页面，「允许学生输入」不会生效，只能靠方糖猫自己上报。
                                </AlertDescription>
                            </Alert>
                        )}

                        <GameSettings
                            value={settings}
                            disabled={startGame.isPending}
                            onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
                        />

                        <div className="flex items-center justify-end gap-3 border-t pt-4">
                            <span className="text-muted-foreground text-sm">
                                已选 {selectedIds.length} 台设备
                            </span>
                            <Button
                                size="lg"
                                loading={startGame.isPending}
                                disabled={selectedIds.length === 0 || noSubmitChannel}
                                onClick={handleStart}
                            >
                                <Play />
                                开始游戏
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
