import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";

import {
    DEFAULT_PROMPT_TEMPLATE,
    DURATION_MINUTES_RANGE,
    PASSWORD_LENGTH_RANGE,
    PASSWORD_PLACEHOLDER,
    PasswordMode,
    type PasswordModeType,
    STUDENT_PLACEHOLDER,
} from "../../../shared/contract";

export type GameSettingsValue = {
    title: string;
    promptTemplate: string;
    passwordMode: PasswordModeType;
    passwordLength: number;
    durationMinutes: number;
    allowDeviceReport: boolean;
    allowStudentInput: boolean;
    enableStudentView: boolean;
    lockStudentEdits: boolean;
};

export const DEFAULT_GAME_SETTINGS: GameSettingsValue = {
    title: "破解保险箱",
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
    // 默认每人一个密码：既能排名，也顺手堵死互相抄答案。
    passwordMode: PasswordMode.PER_STUDENT,
    passwordLength: 4,
    durationMinutes: 10,
    allowDeviceReport: true,
    allowStudentInput: true,
    enableStudentView: true,
    lockStudentEdits: true,
};

/** 用下拉而不是数字输入框：老师站在讲台上点两下就好，也省掉一堆边界校验。 */
const PASSWORD_LENGTH_OPTIONS = Array.from(
    { length: PASSWORD_LENGTH_RANGE.max - PASSWORD_LENGTH_RANGE.min + 1 },
    (_, index) => PASSWORD_LENGTH_RANGE.min + index,
);

const DURATION_OPTIONS = [3, 5, 10, 15, 20, 30, 45, 60].filter(
    (minutes) => minutes >= DURATION_MINUTES_RANGE.min && minutes <= DURATION_MINUTES_RANGE.max,
);

type ToggleRowProps = {
    id: string;
    title: string;
    description: string;
    checked: boolean;
    disabled?: boolean;
    onCheckedChange: (checked: boolean) => void;
};

function ToggleRow({ id, title, description, checked, disabled, onCheckedChange }: ToggleRowProps) {
    return (
        <div className="flex items-start justify-between gap-4 rounded-lg border px-3.5 py-3">
            <div className="space-y-0.5">
                <Label htmlFor={id} className="text-sm">
                    {title}
                </Label>
                <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
            </div>
            <Switch
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onCheckedChange}
                className="mt-0.5"
            />
        </div>
    );
}

type GameSettingsProps = {
    value: GameSettingsValue;
    disabled?: boolean;
    onChange: (patch: Partial<GameSettingsValue>) => void;
};

export function GameSettings({ value, disabled, onChange }: GameSettingsProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="game-title">活动标题</Label>
                <Input
                    id="game-title"
                    value={value.title}
                    disabled={disabled}
                    placeholder="破解保险箱"
                    onChange={(event) => onChange({ title: event.target.value })}
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="game-prompt">方糖猫提示词</Label>
                <Textarea
                    id="game-prompt"
                    rows={10}
                    value={value.promptTemplate}
                    disabled={disabled}
                    className="min-h-52 font-mono text-xs leading-relaxed"
                    onChange={(event) => onChange({ promptTemplate: event.target.value })}
                />
                <p className="text-muted-foreground text-xs leading-relaxed">
                    可用占位符：
                    <code className="bg-muted mx-1 rounded px-1 py-0.5">
                        {PASSWORD_PLACEHOLDER}
                    </code>
                    会被替换成这台设备的密码，
                    <code className="bg-muted mx-1 rounded px-1 py-0.5">{STUDENT_PLACEHOLDER}</code>
                    会被替换成学生的称呼。开始游戏时提示词会自动下发到每台方糖猫。
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                    <Label htmlFor="game-password-mode">密码模式</Label>
                    <Select
                        value={value.passwordMode}
                        disabled={disabled}
                        onValueChange={(next) =>
                            onChange({ passwordMode: next as PasswordModeType })
                        }
                    >
                        <SelectTrigger id="game-password-mode" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={PasswordMode.PER_STUDENT}>
                                每人不同（竞速）
                            </SelectItem>
                            <SelectItem value={PasswordMode.SHARED}>全班同一个（协作）</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="game-password-length">密码位数</Label>
                    <Select
                        value={String(value.passwordLength)}
                        disabled={disabled}
                        onValueChange={(next) => onChange({ passwordLength: Number(next) })}
                    >
                        <SelectTrigger id="game-password-length" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PASSWORD_LENGTH_OPTIONS.map((length) => (
                                <SelectItem key={length} value={String(length)}>
                                    {length} 位
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="game-duration">时长</Label>
                    <Select
                        value={String(value.durationMinutes)}
                        disabled={disabled}
                        onValueChange={(next) => onChange({ durationMinutes: Number(next) })}
                    >
                        <SelectTrigger id="game-duration" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DURATION_OPTIONS.map((minutes) => (
                                <SelectItem key={minutes} value={String(minutes)}>
                                    {minutes} 分钟
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
                <ToggleRow
                    id="game-allow-device-report"
                    title="允许设备上报"
                    description="方糖猫被说服后自己调用工具上报，学生不用手动输入。"
                    checked={value.allowDeviceReport}
                    disabled={disabled}
                    onCheckedChange={(checked) => onChange({ allowDeviceReport: checked })}
                />
                <ToggleRow
                    id="game-allow-student-input"
                    title="允许学生输入"
                    description="学生端出现密码输入框，可以手动提交答案。"
                    checked={value.allowStudentInput}
                    disabled={disabled}
                    onCheckedChange={(checked) => onChange({ allowStudentInput: checked })}
                />
                <ToggleRow
                    id="game-enable-student-view"
                    title="启用学生端"
                    description="学生没有自己的设备时可以整个关掉，只用大屏。"
                    checked={value.enableStudentView}
                    disabled={disabled}
                    onCheckedChange={(checked) => onChange({ enableStudentView: checked })}
                />
                <ToggleRow
                    id="game-lock-student-edits"
                    title="锁定学生修改设备"
                    description="游戏期间禁止学生改自己方糖猫的设置，避免直接翻出提示词。"
                    checked={value.lockStudentEdits}
                    disabled={disabled}
                    onCheckedChange={(checked) => onChange({ lockStudentEdits: checked })}
                />
            </div>
        </div>
    );
}
