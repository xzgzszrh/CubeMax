import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import { Label } from "@buildingai/ui/components/ui/label";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import { Cat, PlugZap, Unplug, Users } from "lucide-react";

import type { SelectableDevice } from "../../../shared/contract";

type DevicePickerProps = {
    devices: SelectableDevice[];
    loading: boolean;
    selectedIds: string[];
    onToggle: (agentBindingId: string) => void;
    onSelectAll: () => void;
    onClear: () => void;
};

/** MCP 接入状态标签。`null` 是最要命的一种，必须让老师一眼看见。 */
function McpBadge({ mcpConnected }: { mcpConnected: boolean | null }) {
    if (mcpConnected === true) {
        return (
            <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
                <PlugZap />
                MCP 已连接
            </Badge>
        );
    }

    if (mcpConnected === false) {
        return (
            <Badge variant="destructive">
                <Unplug />
                MCP 已断开
            </Badge>
        );
    }

    return (
        <Badge variant="destructive">
            <Unplug />
            未接入 MCP，方糖猫无法自动上报
        </Badge>
    );
}

export function DevicePicker({
    devices,
    loading,
    selectedIds,
    onToggle,
    onSelectAll,
    onClear,
}: DevicePickerProps) {
    const selectable = devices.filter((device) => !device.busy);
    const allSelected = selectable.length > 0 && selectedIds.length === selectable.length;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Users className="text-muted-foreground size-4" />
                    <span className="text-sm font-medium">
                        参与设备
                        <span className="text-muted-foreground ml-1.5 font-normal">
                            已选 {selectedIds.length} / 可选 {selectable.length}
                        </span>
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onSelectAll}
                        disabled={loading || allSelected || selectable.length === 0}
                    >
                        全选
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClear}
                        disabled={loading || selectedIds.length === 0}
                    >
                        清空
                    </Button>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-10">
                    <Spinner className="text-muted-foreground size-6" />
                </div>
            )}

            {!loading && devices.length === 0 && (
                <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
                    这个班级下还没有方糖猫设备，请先在课堂管理里把设备分配给学生。
                </div>
            )}

            {!loading && devices.length > 0 && (
                <div className="divide-border overflow-hidden rounded-lg border">
                    {devices.map((device) => {
                        const checkboxId = `device-${device.agentBindingId}`;
                        const checked = selectedIds.includes(device.agentBindingId);

                        return (
                            <div
                                key={device.agentBindingId}
                                data-disabled={device.busy || undefined}
                                className="hover:bg-muted/40 flex items-start gap-3 border-b px-4 py-3 last:border-b-0 data-disabled:opacity-60 data-disabled:hover:bg-transparent"
                            >
                                <Checkbox
                                    id={checkboxId}
                                    className="mt-1"
                                    checked={checked}
                                    disabled={device.busy}
                                    onCheckedChange={() => onToggle(device.agentBindingId)}
                                />
                                <Label
                                    htmlFor={checkboxId}
                                    className="flex flex-1 flex-col items-start gap-1"
                                >
                                    <span className="flex flex-wrap items-center gap-2">
                                        <Cat className="text-muted-foreground size-4" />
                                        <span className="font-medium">{device.name}</span>
                                        <span className="text-muted-foreground text-xs font-normal">
                                            {device.studentName
                                                ? `学生：${device.studentName}`
                                                : "未绑定学生"}
                                        </span>
                                    </span>
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <McpBadge mcpConnected={device.mcpConnected} />
                                        {device.busy && (
                                            <Badge variant="outline">已被其它活动占用</Badge>
                                        )}
                                    </span>
                                </Label>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
