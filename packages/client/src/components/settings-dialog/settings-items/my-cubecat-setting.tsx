import {
  type CubeCatDeviceType,
  type CubeCatManagedDevice,
  getActiveOrganizationId,
  useCubeCatDevicesQuery,
  useLinkBuildingAgentMutation,
  useMyAgentsInfiniteQuery,
  useUpdateCubeCatDeviceSettingsMutation,
  useUpdateCubeCatDeviceTypeMutation,
  useUpdateXiaozhiDeviceAliasMutation,
  useUpdateXiaozhiDeviceAutoUpdateMutation,
  useWorkspaceContextQuery,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Slider } from "@buildingai/ui/components/ui/slider";
import { Switch } from "@buildingai/ui/components/ui/switch";
import {
  Boxes,
  Check,
  ChevronRight,
  CircleHelp,
  Cpu,
  Fingerprint,
  HardDrive,
  LoaderCircle,
  MoonStar,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import cubeCatLiteImage from "@/assets/cubecat-lite.png";
import cubeCatSImage from "@/assets/cubecat-s.png";

const DEVICE_TYPE_OPTIONS: Array<{ value: CubeCatDeviceType; label: string }> = [
  { value: "unknown", label: "型号待指定" },
  { value: "CubeCat-Lite", label: "CubeCat-Lite" },
  { value: "CubeCat-S", label: "CubeCat-S" },
];

function deviceImage(type: CubeCatDeviceType) {
  return type === "CubeCat-S" ? cubeCatSImage : cubeCatLiteImage;
}

function displayDeviceName(device: CubeCatManagedDevice) {
  return device.alias || device.deviceTypeLabel || `方糖猫 ${device.id}`;
}

function shortIdentifier(value: string) {
  if (!value) return "未上报";
  if (value.length <= 14) return value;
  return `${value.slice(0, 7)}…${value.slice(-5)}`;
}

function lastSeenLabel(value: string | null) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function DeviceCard({ device, onOpen }: { device: CubeCatManagedDevice; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="group bg-card hover:border-foreground/20 hover:shadow-foreground/5 flex min-h-64 w-full flex-col overflow-hidden rounded-lg border text-left shadow-sm transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.99]"
      onClick={onOpen}
    >
      <div className="bg-muted/50 relative flex h-40 w-full items-center justify-center overflow-hidden">
        <img
          src={deviceImage(device.deviceType)}
          alt={device.deviceTypeLabel}
          className={`h-36 w-44 object-contain transition-transform duration-300 group-hover:scale-[1.04] ${
            device.online ? "" : "grayscale"
          }`}
        />
        <Badge
          className="absolute top-3 left-3 gap-1.5 bg-white/90 text-zinc-800 shadow-sm backdrop-blur dark:bg-zinc-950/80 dark:text-zinc-100"
          variant="outline"
        >
          <span
            className={`size-1.5 rounded-full ${device.online ? "bg-emerald-500" : "bg-zinc-400"}`}
          />
          {device.online ? "在线" : "离线"}
        </Badge>
        {device.deviceType === "unknown" ? (
          <span className="text-muted-foreground absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-white/90 shadow-sm dark:bg-zinc-950/80">
            <CircleHelp className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="flex w-full flex-1 items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{displayDeviceName(device)}</p>
          <p className="text-muted-foreground mt-1 text-xs">{device.deviceTypeLabel}</p>
          <div className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
            <Sparkles className="size-3.5" />
            <span className="truncate">{device.linkedAgentName || "尚未选择智能体"}</span>
          </div>
        </div>
        <ChevronRight className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function PreferenceSlider({
  icon: Icon,
  label,
  value,
  disabled,
  onCommit,
}: {
  icon: typeof Volume2;
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="grid grid-cols-[120px_1fr_38px] items-center gap-3 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="text-muted-foreground size-4" />
        <span>{label}</span>
      </div>
      <Slider
        value={[draft]}
        min={0}
        max={100}
        step={5}
        disabled={disabled}
        onValueChange={(next) => setDraft(next[0] ?? draft)}
        onValueCommit={(next) => onCommit(next[0] ?? draft)}
      />
      <span className="text-muted-foreground text-right text-xs tabular-nums">{draft}%</span>
    </div>
  );
}

function DeviceDetailDialog({
  device,
  open,
  onOpenChange,
}: {
  device: CubeCatManagedDevice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [alias, setAlias] = useState("");
  const { data: myAgentsData, isLoading: myAgentsLoading } = useMyAgentsInfiniteQuery(
    { pageSize: 100 },
    { enabled: open },
  );
  const myAgents = myAgentsData?.pages.flatMap((page) => page.items) || [];

  useEffect(() => setAlias(device?.alias || ""), [device?.alias, device?.id]);

  const linkAgent = useLinkBuildingAgentMutation({
    onSuccess: () => toast.success("智能体已切换，角色设定已同步到方糖猫"),
  });
  const updateAlias = useUpdateXiaozhiDeviceAliasMutation({
    onSuccess: () => toast.success("设备名称已保存"),
  });
  const updateAutoUpdate = useUpdateXiaozhiDeviceAutoUpdateMutation({
    onSuccess: () => toast.success("自动升级设置已更新"),
  });
  const updateType = useUpdateCubeCatDeviceTypeMutation({
    onSuccess: () => toast.success("设备型号已更新"),
  });
  const updateSettings = useUpdateCubeCatDeviceSettingsMutation({
    onSuccess: () => toast.success("设备偏好已保存"),
  });

  if (!device) return null;
  const busy =
    linkAgent.isPending ||
    updateAlias.isPending ||
    updateAutoUpdate.isPending ||
    updateType.isPending ||
    updateSettings.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(820px,92dvh)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogTitle className="sr-only">{displayDeviceName(device)}</DialogTitle>
        <DialogDescription className="sr-only">管理方糖猫设备、智能体和偏好设置</DialogDescription>
        <div className="grid min-h-0 md:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="bg-muted/45 flex flex-col border-b p-6 md:border-r md:border-b-0">
            <div className="flex min-h-56 items-center justify-center">
              <img
                src={deviceImage(device.deviceType)}
                alt={device.deviceTypeLabel}
                className={`h-52 w-full object-contain ${device.online ? "" : "grayscale"}`}
              />
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-xl font-semibold">
                  {displayDeviceName(device)}
                </h2>
                <span
                  className={`size-2 shrink-0 rounded-full ${device.online ? "bg-emerald-500" : "bg-zinc-400"}`}
                />
              </div>
              <p className="text-muted-foreground mt-1 text-sm">{device.deviceTypeLabel}</p>
            </div>

            <div className="mt-6 space-y-3 border-t pt-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  {device.online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}状态
                </span>
                <span>{device.online ? "在线" : "离线"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Cpu className="size-4" />
                  固件
                </span>
                <span className="truncate">{device.appVersion || "未上报"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Fingerprint className="size-4" />
                  序列号
                </span>
                <span title={device.serialNumber}>{shortIdentifier(device.serialNumber)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground flex items-center gap-2">
                  <HardDrive className="size-4" />
                  MAC
                </span>
                <span title={device.macAddress}>{shortIdentifier(device.macAddress)}</span>
              </div>
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <section className="pb-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="size-4" />
                <h3 className="font-medium">当前智能体</h3>
              </div>
              <Select
                value={device.linkedAgentId || "none"}
                disabled={!device.canManage || linkAgent.isPending || myAgentsLoading}
                onValueChange={(value) =>
                  linkAgent.mutate({
                    agentId: device.agentId,
                    buildingAgentId: value === "none" ? null : value,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={myAgentsLoading ? "正在读取智能体" : "选择智能体"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不使用 BuildingAI 智能体</SelectItem>
                  {myAgents.map((agent) => (
                    <SelectItem value={agent.id} key={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {device.agentDeviceCount > 1 ? (
                <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  <Boxes className="mt-0.5 size-3.5 shrink-0" />
                  该智能体组包含 {device.agentDeviceCount}{" "}
                  台设备，切换后同组设备会使用相同角色设定。
                </p>
              ) : null}
              <div className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="truncate">模型：{device.model || "由小智默认配置"}</span>
                <span className="truncate">音色：{device.voice || "由小智默认配置"}</span>
              </div>
            </section>

            <section className="border-t py-5">
              <div className="mb-3 flex items-center gap-2">
                <Settings2 className="size-4" />
                <h3 className="font-medium">设备设置</h3>
              </div>
              <div className="flex gap-2">
                <Input
                  value={alias}
                  maxLength={80}
                  disabled={!device.canManage}
                  placeholder="设备名称"
                  onChange={(event) => setAlias(event.target.value)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  title="保存设备名称"
                  disabled={!device.canManage || alias.trim() === device.alias || !alias.trim()}
                  loading={updateAlias.isPending}
                  onClick={() =>
                    updateAlias.mutate({
                      agentId: device.agentId,
                      deviceId: device.id,
                      macAddress: device.macAddress,
                      alias: alias.trim(),
                    })
                  }
                >
                  <Check />
                </Button>
              </div>

              {device.canSetDeviceType ? (
                <div className="mt-3 flex items-center justify-between gap-4 py-2">
                  <Label>设备型号</Label>
                  <Select
                    value={device.deviceType}
                    disabled={updateType.isPending}
                    onValueChange={(value) =>
                      updateType.mutate({
                        agentId: device.agentId,
                        deviceId: device.id,
                        deviceType: value as CubeCatDeviceType,
                      })
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEVICE_TYPE_OPTIONS.map((option) => (
                        <SelectItem value={option.value} key={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <PreferenceSlider
                icon={Volume2}
                label="音量"
                value={device.settings.volume}
                disabled={!device.canManage || updateSettings.isPending}
                onCommit={(volume) =>
                  updateSettings.mutate({ agentId: device.agentId, deviceId: device.id, volume })
                }
              />
              <PreferenceSlider
                icon={SunMedium}
                label="屏幕亮度"
                value={device.settings.brightness}
                disabled={!device.canManage || updateSettings.isPending}
                onCommit={(brightness) =>
                  updateSettings.mutate({
                    agentId: device.agentId,
                    deviceId: device.id,
                    brightness,
                  })
                }
              />

              <div className="flex items-center justify-between gap-4 border-t py-4">
                <div className="flex items-center gap-2 text-sm">
                  <MoonStar className="text-muted-foreground size-4" />
                  <span>勿扰模式</span>
                </div>
                <Switch
                  checked={device.settings.doNotDisturb}
                  disabled={!device.canManage || updateSettings.isPending}
                  onCheckedChange={(doNotDisturb) =>
                    updateSettings.mutate({
                      agentId: device.agentId,
                      deviceId: device.id,
                      doNotDisturb,
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 border-t py-4">
                <div>
                  <p className="flex items-center gap-2 text-sm">
                    <RefreshCw className="text-muted-foreground size-4" />
                    自动升级
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">接收稳定版设备固件</p>
                </div>
                <Switch
                  checked={device.autoUpdate}
                  disabled={!device.canManage || updateAutoUpdate.isPending}
                  onCheckedChange={(autoUpdate) =>
                    updateAutoUpdate.mutate({
                      agentId: device.agentId,
                      deviceId: device.id,
                      macAddress: device.macAddress,
                      autoUpdate,
                    })
                  }
                />
              </div>
            </section>

            <section className="text-muted-foreground border-t pt-5 text-xs">
              <div className="grid gap-2 sm:grid-cols-2">
                <span>设备板型：{device.boardName || "未上报"}</span>
                <span>最后连接：{lastSeenLabel(device.lastConnectedAt)}</span>
                <span>小智设备 ID：{device.id}</span>
                <span>智能体组：{device.agentName}</span>
              </div>
            </section>
          </div>
        </div>
        <DialogFooter className="border-t px-6 py-3">
          <span className="text-muted-foreground mr-auto flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5" />
            设备资料仅在当前工作空间可见
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Device-only CubeCat view shared by account settings and the student classroom.
 * xiaozhi account credentials deliberately live in Podium > Device Management.
 */
export function CubeCatDeviceManager() {
  const organizationId = getActiveOrganizationId();
  const { data: workspaceContext } = useWorkspaceContextQuery();
  const activeOrganization = workspaceContext?.organizations.find(
    (item) => item.id === organizationId,
  );

  const { data: devices = [], isLoading, isFetching, refetch } = useCubeCatDevicesQuery();
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<string | null>(null);
  const selectedDevice =
    devices.find((device) => `${device.agentId}:${device.id}` === selectedDeviceKey) || null;

  const summary = useMemo(
    () => ({
      online: devices.filter((device) => device.online).length,
      linked: devices.filter((device) => device.linkedAgentId).length,
      types: new Set(
        devices.map((device) => device.deviceType).filter((type) => type !== "unknown"),
      ).size,
    }),
    [devices],
  );

  return (
    <div className="pb-4">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">我的方糖猫</h2>
            {devices.length ? <Badge variant="secondary">{devices.length} 台</Badge> : null}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {activeOrganization ? activeOrganization.name : "个人空间"}
          </p>
        </div>
        <Button
          size="icon"
          variant="outline"
          title="刷新设备"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          <RefreshCw className={isFetching ? "animate-spin" : ""} />
        </Button>
      </header>

      {devices.length ? (
        <div className="grid grid-cols-3 border-b py-4 text-center">
          <div>
            <p className="text-xl font-semibold tabular-nums">{summary.online}</p>
            <p className="text-muted-foreground text-xs">在线设备</p>
          </div>
          <div className="border-x">
            <p className="text-xl font-semibold tabular-nums">{summary.linked}</p>
            <p className="text-muted-foreground text-xs">已设置智能体</p>
          </div>
          <div>
            <p className="text-xl font-semibold tabular-nums">{summary.types}</p>
            <p className="text-muted-foreground text-xs">设备型号</p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-96 items-center justify-center">
          <LoaderCircle className="text-muted-foreground size-5 animate-spin" />
        </div>
      ) : devices.length ? (
        <div className="grid grid-cols-1 gap-4 pt-5 lg:grid-cols-2">
          {devices.map((device) => (
            <DeviceCard
              key={`${device.agentId}:${device.id}`}
              device={device}
              onOpen={() => setSelectedDeviceKey(`${device.agentId}:${device.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-96 flex-col items-center justify-center text-center">
          <div className="relative h-44 w-72">
            <img
              src={cubeCatLiteImage}
              alt="CubeCat-Lite"
              className="absolute bottom-0 left-4 h-36 w-36 object-contain"
            />
            <img
              src={cubeCatSImage}
              alt="CubeCat-S"
              className="absolute right-1 bottom-1 h-32 w-36 object-contain"
            />
          </div>
          <h3 className="mt-2 font-medium">还没有可用的方糖猫</h3>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm">
            {activeOrganization
              ? "老师或组织管理员分配设备后，会自动显示在这里。"
              : "方糖猫由老师或组织管理员在团队中分配，请切换到对应的团队工作空间查看。"}
          </p>
        </div>
      )}

      <DeviceDetailDialog
        device={selectedDevice}
        open={Boolean(selectedDevice)}
        onOpenChange={(next) => {
          if (!next) setSelectedDeviceKey(null);
        }}
      />
    </div>
  );
}

export function MyCubeCatSetting() {
  return <CubeCatDeviceManager />;
}
