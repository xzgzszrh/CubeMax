import {
  useExecuteXiaomiHomeActionMutation,
  useImportXiaomiHomeCredentialsMutation,
  useRefreshXiaomiHomeDeviceMutation,
  useSetXiaomiHomePropertyMutation,
  useStartXiaomiHomeOAuthMutation,
  useSyncXiaomiHomeAccountMutation,
  useXiaomiHomeAccountsQuery,
  useXiaomiHomeDeviceQuery,
  useXiaomiHomeDevicesQuery,
  XIAOMI_HOME_SERVERS,
  type XiaomiHomeAccount,
  type XiaomiHomeCapability,
  type XiaomiHomeDevice,
  type XiaomiHomeOAuthStart,
  type XiaomiHomePropertyCommand,
  type XiaomiHomeServer,
} from "@buildingai/services/web";
import { Alert, AlertDescription, AlertTitle } from "@buildingai/ui/components/ui/alert";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@buildingai/ui/components/ui/empty";
import { Input } from "@buildingai/ui/components/ui/input";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@buildingai/ui/components/ui/sheet";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Slider } from "@buildingai/ui/components/ui/slider";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { useIsMobile } from "@buildingai/ui/hooks/use-mobile";
import { cn } from "@buildingai/ui/lib/utils";
import {
  AirVent,
  Bell,
  Blinds,
  Boxes,
  BrushCleaning,
  Check,
  ChevronRight,
  CircleGauge,
  Cloud,
  Copy,
  DoorOpen,
  Droplets,
  Fan,
  Home,
  Lightbulb,
  LockKeyhole,
  type LucideIcon,
  MapPin,
  MonitorPlay,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Speaker,
  TerminalSquare,
  TextCursorInput,
  Thermometer,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  binary_sensor: ShieldAlert,
  button: CircleGauge,
  camera: MonitorPlay,
  climate: AirVent,
  cover: Blinds,
  device_tracker: MapPin,
  event: Bell,
  fan: Fan,
  humidifier: Droplets,
  light: Lightbulb,
  lock: LockKeyhole,
  media_player: Speaker,
  number: SlidersHorizontal,
  notify: Bell,
  other: Boxes,
  select: SlidersHorizontal,
  sensor: Thermometer,
  switch: Plug,
  text: TextCursorInput,
  vacuum: BrushCleaning,
  water_heater: Thermometer,
};

const CATEGORY_ORDER = [
  "light",
  "switch",
  "climate",
  "fan",
  "humidifier",
  "cover",
  "media_player",
  "vacuum",
  "water_heater",
  "lock",
  "camera",
  "number",
  "select",
  "button",
  "sensor",
  "binary_sensor",
  "device_tracker",
  "event",
  "notify",
  "text",
  "other",
];

const NUMERIC_FORMATS = new Set([
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "int8",
  "int16",
  "int32",
  "int64",
  "float",
  "double",
]);

function formatCapabilityName(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "尚未同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatState(value: unknown): string {
  if (typeof value === "boolean") return value ? "开启" : "关闭";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getState(device: XiaomiHomeDevice, capability: XiaomiHomeCapability): unknown {
  if (capability.piid === undefined) return undefined;
  return device.state[`${capability.siid}.${capability.piid}`];
}

function parseInputValue(format: string | undefined, value: string): unknown {
  if (format === "bool") return value === "true";
  if (NUMERIC_FORMATS.has(format || "")) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

function getDeviceIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] || Boxes;
}

function AccountStatus({ account }: { account: XiaomiHomeAccount }) {
  if (account.status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        已连接
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <span className="size-1.5 rounded-full bg-amber-500" />
      {account.status === "auth_error" ? "需要重新授权" : "同步异常"}
    </span>
  );
}

function PropertyEditor({
  device,
  capability,
  disabled,
  onChange,
}: {
  device: XiaomiHomeDevice;
  capability: XiaomiHomeCapability;
  disabled: boolean;
  onChange: (command: XiaomiHomePropertyCommand) => void;
}) {
  const value = getState(device, capability);
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));

  useEffect(() => {
    setDraft(value === undefined ? "" : String(value));
  }, [value]);

  if (capability.format === "bool") {
    return (
      <Switch
        checked={value === true || value === 1 || value === "true"}
        onCheckedChange={(checked) =>
          onChange({ siid: capability.siid, piid: capability.piid!, value: checked })
        }
        disabled={disabled}
        aria-label={formatCapabilityName(capability.name)}
      />
    );
  }

  if (capability.valueList?.length) {
    return (
      <Select
        value={value === undefined ? undefined : String(value)}
        onValueChange={(next) => {
          const option = capability.valueList?.find((item) => String(item.value) === next);
          onChange({ siid: capability.siid, piid: capability.piid!, value: option?.value ?? next });
        }}
        disabled={disabled}
      >
        <SelectTrigger size="sm" className="w-full max-w-44">
          <SelectValue placeholder="选择模式" />
        </SelectTrigger>
        <SelectContent>
          {capability.valueList.map((item) => (
            <SelectItem key={String(item.value)} value={String(item.value)}>
              {item.description || String(item.value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (capability.valueRange && NUMERIC_FORMATS.has(capability.format || "")) {
    const numericValue =
      typeof value === "number" ? value : Number(value ?? capability.valueRange.min);
    const sliderValue = Number.isFinite(numericValue) ? numericValue : capability.valueRange.min;
    return (
      <div className="flex w-full max-w-52 items-center gap-3">
        <Slider
          value={[sliderValue]}
          min={capability.valueRange.min}
          max={capability.valueRange.max}
          step={capability.valueRange.step || 1}
          onValueCommit={(values) =>
            onChange({ siid: capability.siid, piid: capability.piid!, value: values[0] })
          }
          disabled={disabled}
          aria-label={formatCapabilityName(capability.name)}
        />
        <span className="w-12 shrink-0 text-right text-xs tabular-nums">
          {formatState(sliderValue)}
          {capability.unit || ""}
        </span>
      </div>
    );
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft === "" && value === undefined) return;
        onChange({
          siid: capability.siid,
          piid: capability.piid!,
          value: parseInputValue(capability.format, draft),
        });
      }}
      disabled={disabled}
      className="h-8 w-full max-w-44 text-right"
      aria-label={formatCapabilityName(capability.name)}
    />
  );
}

function ActionControl({
  capability,
  disabled,
  onExecute,
}: {
  capability: XiaomiHomeCapability;
  disabled: boolean;
  onExecute: (values: unknown[]) => void;
}) {
  const [values, setValues] = useState<string[]>(() => (capability.input || []).map(() => ""));
  const inputs = capability.input || [];
  const setValue = (index: number, value: string) =>
    setValues((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {inputs.map((input, index) => {
        const label = input.description || formatCapabilityName(input.name);
        if (input.format === "bool") {
          return (
            <Select
              key={`${input.piid}-${index}`}
              value={values[index] || undefined}
              onValueChange={(value) => setValue(index, value)}
              disabled={disabled}
            >
              <SelectTrigger size="sm" className="w-28" aria-label={label}>
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">开启</SelectItem>
                <SelectItem value="false">关闭</SelectItem>
              </SelectContent>
            </Select>
          );
        }
        if (input.valueList?.length) {
          return (
            <Select
              key={`${input.piid}-${index}`}
              value={values[index] || undefined}
              onValueChange={(value) => setValue(index, value)}
              disabled={disabled}
            >
              <SelectTrigger size="sm" className="w-32" aria-label={label}>
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                {input.valueList.map((option) => (
                  <SelectItem key={String(option.value)} value={String(option.value)}>
                    {option.description || String(option.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return (
          <Input
            key={`${input.piid}-${index}`}
            type={NUMERIC_FORMATS.has(input.format || "") ? "number" : "text"}
            min={input.valueRange?.min}
            max={input.valueRange?.max}
            step={input.valueRange?.step}
            value={values[index] || ""}
            onChange={(event) => setValue(index, event.target.value)}
            placeholder={label}
            disabled={disabled}
            className="h-8 w-28 text-xs"
            aria-label={label}
          />
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || values.some((value) => value === "")}
        onClick={() =>
          onExecute(
            inputs.map((input, index) => parseInputValue(input.format, values[index] || "")),
          )
        }
      >
        执行
      </Button>
    </div>
  );
}

function DeviceDetail({
  device,
  onClose,
  onRefresh,
  onProperty,
  onAction,
  pendingKey,
  refreshing,
}: {
  device: XiaomiHomeDevice;
  onClose?: () => void;
  onRefresh: () => void;
  onProperty: (command: XiaomiHomePropertyCommand) => void;
  onAction: (capability: XiaomiHomeCapability, values: unknown[]) => void;
  pendingKey: string | null;
  refreshing: boolean;
}) {
  const Icon = getDeviceIcon(device.category);
  const properties = device.capabilities.filter(
    (capability) => capability.kind === "property" && capability.piid !== undefined,
  );
  const actions = device.capabilities.filter(
    (capability) => capability.kind === "action" && capability.aiid !== undefined,
  );
  const groups = new Map<
    string,
    { label: string; properties: XiaomiHomeCapability[]; actions: XiaomiHomeCapability[] }
  >();
  for (const property of properties) {
    const group = groups.get(property.serviceName) || {
      label: property.serviceDescription || formatCapabilityName(property.serviceName),
      properties: [],
      actions: [],
    };
    group.properties.push(property);
    groups.set(property.serviceName, group);
  }
  for (const action of actions) {
    const group = groups.get(action.serviceName) || {
      label: action.serviceDescription || formatCapabilityName(action.serviceName),
      properties: [],
      actions: [],
    };
    group.actions.push(action);
    groups.set(action.serviceName, group);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{device.name}</h2>
              {onClose ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onClose}
                  aria-label="关闭设备详情"
                  title="关闭"
                >
                  <X />
                </Button>
              ) : null}
            </div>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span>{device.categoryLabel}</span>
              <span>·</span>
              <span>{device.roomName || device.homeName || "未分配房间"}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Badge
            variant="outline"
            className={
              device.online
                ? "border-emerald-200 text-emerald-700 dark:text-emerald-400"
                : "text-muted-foreground"
            }
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                device.online ? "bg-emerald-500" : "bg-zinc-400",
              )}
            />
            {device.online ? "在线" : "离线"}
          </Badge>
          <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            刷新状态
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-5">
          {[...groups.entries()].map(([serviceName, group]) => (
            <section key={serviceName}>
              <div className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase">
                {group.label}
              </div>
              <div className="divide-y rounded-lg border">
                {group.properties.map((capability) => {
                  const key = `${capability.siid}.${capability.piid}`;
                  const readable = capability.access?.includes("read");
                  const writable = capability.access?.includes("write");
                  const value = getState(device, capability);
                  return (
                    <div key={key} className="flex min-h-14 items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          {formatCapabilityName(capability.name)}
                        </div>
                        <div className="text-muted-foreground mt-0.5 truncate text-[11px]">
                          {capability.description || `${capability.siid}.${capability.piid}`}
                          {capability.unit ? ` · ${capability.unit}` : ""}
                        </div>
                      </div>
                      {writable ? (
                        <PropertyEditor
                          device={device}
                          capability={capability}
                          disabled={pendingKey === key}
                          onChange={onProperty}
                        />
                      ) : (
                        <span className="text-muted-foreground max-w-32 truncate text-right text-xs tabular-nums">
                          {readable ? formatState(value) : "只读不可用"}
                        </span>
                      )}
                    </div>
                  );
                })}
                {group.actions.map((capability) => {
                  const key = `${capability.siid}.${capability.aiid}`;
                  return (
                    <div key={key} className="flex min-h-14 items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          {formatCapabilityName(capability.name)}
                        </div>
                        <div className="text-muted-foreground mt-0.5 truncate text-[11px]">
                          {capability.description || "设备动作"}
                        </div>
                      </div>
                      <ActionControl
                        capability={capability}
                        disabled={pendingKey === key}
                        onExecute={(values) => onAction(capability, values)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {!groups.size ? (
            <Empty className="min-h-48 border-dashed p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Boxes />
                </EmptyMedia>
                <EmptyTitle>暂无可用能力</EmptyTitle>
                <EmptyDescription>该设备没有返回可读取或可控制的 MIoT 属性。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          <div className="text-muted-foreground border-t pt-4 text-[11px]">
            型号 {device.model || "未知"} · 最近读取 {formatDate(device.lastStateAt)}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default function SmartHomePage() {
  const isMobile = useIsMobile();
  const [cloudServer, setCloudServer] = useState<XiaomiHomeServer>("cn");
  const [selectedAccountId, setSelectedAccountId] = useState<string>();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [selectedHomeId, setSelectedHomeId] = useState<string>("all");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword.trim().toLocaleLowerCase());
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [localTokenStart, setLocalTokenStart] = useState<XiaomiHomeOAuthStart | null>(null);
  const [localTokenCloudServer, setLocalTokenCloudServer] = useState<XiaomiHomeServer>("cn");
  const [localCredentials, setLocalCredentials] = useState("");
  const [localCommandCopied, setLocalCommandCopied] = useState(false);
  const oauthWindowRef = useRef<Window | null>(null);

  const accountsQuery = useXiaomiHomeAccountsQuery();
  const accounts = accountsQuery.data || [];
  const activeAccount = accounts.find((account) => account.id === selectedAccountId);

  useEffect(() => {
    if (!accounts.length) {
      setSelectedAccountId(undefined);
      return;
    }
    if (!selectedAccountId || !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    setSelectedHomeId("all");
    setSelectedRoomId("all");
    setSelectedCategory("all");
    setSelectedDeviceId(undefined);
    setMobileDetailOpen(false);
  }, [selectedAccountId]);

  const devicesQuery = useXiaomiHomeDevicesQuery(selectedAccountId);
  const devices = devicesQuery.data || [];
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId);
  const detailQuery = useXiaomiHomeDeviceQuery(selectedDeviceId, {
    enabled: Boolean(selectedDeviceId),
  });
  const detailDevice = detailQuery.data || selectedDevice;

  const homes = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const home of activeAccount?.homes || []) {
      map.set(home.id, { id: home.id, name: home.name, count: 0 });
    }
    for (const device of devices) {
      if (!device.homeId) continue;
      const current = map.get(device.homeId) || {
        id: device.homeId,
        name: device.homeName || "未命名家庭",
        count: 0,
      };
      current.count += 1;
      map.set(device.homeId, current);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }, [activeAccount?.homes, devices]);

  const rooms = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const device of devices) {
      if (selectedHomeId !== "all" && device.homeId !== selectedHomeId) continue;
      if (!device.roomId) continue;
      const current = map.get(device.roomId) || {
        id: device.roomId,
        name: device.roomName || "未命名房间",
        count: 0,
      };
      current.count += 1;
      map.set(device.roomId, current);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  }, [devices, selectedHomeId]);

  const categories = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const device of devices) {
      const current = counts.get(device.category) || { label: device.categoryLabel, count: 0 };
      current.count += 1;
      counts.set(device.category, current);
    }
    return [...counts.entries()].sort((a, b) => {
      const order = CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]);
      return order || a[1].label.localeCompare(b[1].label, "zh-CN");
    });
  }, [devices]);

  const visibleDevices = useMemo(
    () =>
      devices.filter((device) => {
        if (selectedHomeId !== "all" && device.homeId !== selectedHomeId) return false;
        if (selectedRoomId !== "all" && device.roomId !== selectedRoomId) return false;
        if (selectedCategory !== "all" && device.category !== selectedCategory) return false;
        if (!deferredKeyword) return true;
        return [device.name, device.model, device.roomName, device.homeName, device.categoryLabel]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(deferredKeyword));
      }),
    [devices, deferredKeyword, selectedCategory, selectedHomeId, selectedRoomId],
  );

  const startOAuthMutation = useStartXiaomiHomeOAuthMutation();
  const importCredentialsMutation = useImportXiaomiHomeCredentialsMutation({
    onSuccess: (account) => {
      setSelectedAccountId(account.id);
      setLocalTokenStart(null);
      setLocalCredentials("");
      toast.success("小米账号已导入并完成同步");
    },
    onError: (error) => toast.error(error.message || "小米凭据导入失败"),
  });
  const syncMutation = useSyncXiaomiHomeAccountMutation({
    onSuccess: (account) => {
      setSelectedAccountId(account.id);
      toast.success("小米家居已同步");
    },
    onError: (error) => toast.error(error.message || "同步失败"),
  });
  const refreshMutation = useRefreshXiaomiHomeDeviceMutation({
    onSuccess: () => toast.success("设备状态已刷新"),
    onError: (error) => toast.error(error.message || "设备状态刷新失败"),
  });
  const propertyMutation = useSetXiaomiHomePropertyMutation({
    onError: (error) => toast.error(error.message || "设备控制失败"),
  });
  const actionMutation = useExecuteXiaomiHomeActionMutation({
    onSuccess: () => toast.success("设备动作已执行"),
    onError: (error) => toast.error(error.message || "设备动作执行失败"),
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent<XiaomiHomeAccount & { type?: string }>) => {
      const message = event.data as
        | { type?: string; success?: boolean; accountId?: string; message?: string }
        | undefined;
      if (!message || message.type !== "buildingai:xiaomi-home-oauth") return;
      if (oauthWindowRef.current && event.source !== oauthWindowRef.current) return;
      oauthWindowRef.current = null;
      if (message.success) {
        if (message.accountId) setSelectedAccountId(message.accountId);
        void accountsQuery.refetch();
        toast.success(message.message || "小米账号已连接");
      } else {
        toast.error(message.message || "小米账号授权失败");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [accountsQuery]);

  const connectAccount = async () => {
    const popup = window.open(
      "about:blank",
      "buildingai-xiaomi-home-oauth",
      "popup,width=520,height=720,resizable=yes,scrollbars=yes",
    );
    if (!popup) {
      toast.error("浏览器阻止了授权窗口，请允许弹出窗口后重试");
      return;
    }
    oauthWindowRef.current = popup;
    try {
      const result = await startOAuthMutation.mutateAsync({ cloudServer, mode: "direct" });
      popup.location.href = result.authorizationUrl;
    } catch (error) {
      popup.close();
      oauthWindowRef.current = null;
      toast.error(error instanceof Error ? error.message : "无法发起小米账号授权");
    }
  };

  const startLocalTokenLogin = async () => {
    try {
      const result = await startOAuthMutation.mutateAsync({
        cloudServer,
        mode: "local_token",
      });
      setLocalTokenCloudServer(result.cloudServer);
      setLocalTokenStart(result);
      setLocalCredentials("");
      setLocalCommandCopied(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法生成本地登录命令");
    }
  };

  const localTokenCommand = localTokenStart
    ? `pnpm xiaomi-home:oauth-token -- ${JSON.stringify(localTokenStart.authorizationUrl)} ${localTokenCloudServer}`
    : "";

  const copyLocalTokenCommand = async () => {
    if (!localTokenCommand) return;
    try {
      await navigator.clipboard.writeText(localTokenCommand);
      setLocalCommandCopied(true);
      toast.success("本地登录命令已复制");
    } catch {
      toast.error("复制失败，请手动复制命令");
    }
  };

  const importLocalCredentials = async () => {
    const credentials = localCredentials.trim();
    if (!credentials) {
      toast.error("请先粘贴本地脚本生成的凭据 JSON");
      return;
    }
    await importCredentialsMutation.mutateAsync(credentials);
  };

  const selectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isMobile) setMobileDetailOpen(true);
  };

  const setProperty = async (command: XiaomiHomePropertyCommand) => {
    if (!detailDevice) return;
    const key = `${command.siid}.${command.piid}`;
    setPendingKey(key);
    try {
      await propertyMutation.mutateAsync({ deviceId: detailDevice.id, command });
    } finally {
      setPendingKey(null);
    }
  };

  const executeAction = async (capability: XiaomiHomeCapability, values: unknown[]) => {
    if (!detailDevice || capability.aiid === undefined) return;
    const key = `${capability.siid}.${capability.aiid}`;
    setPendingKey(key);
    try {
      await actionMutation.mutateAsync({
        deviceId: detailDevice.id,
        command: { siid: capability.siid, aiid: capability.aiid, in: values },
      });
    } finally {
      setPendingKey(null);
    }
  };

  const detail = detailDevice ? (
    <DeviceDetail
      device={detailDevice}
      onClose={() => {
        setSelectedDeviceId(undefined);
        setMobileDetailOpen(false);
      }}
      onRefresh={() => void refreshMutation.mutateAsync(detailDevice.id)}
      onProperty={(command) => void setProperty(command)}
      onAction={(capability, values) => void executeAction(capability, values)}
      pendingKey={pendingKey}
      refreshing={refreshMutation.isPending}
    />
  ) : null;

  return (
    <div className="h-full overflow-y-auto bg-[#f4f6f6] dark:bg-[#111615]">
      <div className="mx-auto flex min-h-full w-full max-w-[1520px] flex-col">
        <header className="border-b bg-white/90 px-4 py-5 backdrop-blur md:px-8 dark:bg-[#17201f]/90">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-amber-700 uppercase dark:text-amber-300">
                <Cloud className="size-3.5" />
                MIOT CLOUD
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">智能家居</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                连接小米家庭，直接管理设备状态与控制能力。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={cloudServer}
                onValueChange={(value) => setCloudServer(value as XiaomiHomeServer)}
              >
                <SelectTrigger className="w-full bg-white sm:w-40 dark:bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {XIAOMI_HOME_SERVERS.map((server) => (
                    <SelectItem key={server.value} value={server.value}>
                      {server.label}云区
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={() => void connectAccount()}
                loading={startOAuthMutation.isPending}
              >
                <Cloud />
                连接小米账号
              </Button>
              {import.meta.env.DEV ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void startLocalTokenLogin()}
                  loading={startOAuthMutation.isPending}
                >
                  <TerminalSquare />
                  本地脚本登录
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {accountsQuery.isLoading ? (
          <div className="grid gap-4 p-4 md:p-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        ) : accountsQuery.isError ? (
          <div className="p-4 md:p-8">
            <Alert variant="destructive">
              <ShieldAlert />
              <AlertTitle>智能家居服务暂不可用</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>请检查服务连接后重试。</span>
                <Button variant="outline" size="sm" onClick={() => accountsQuery.refetch()}>
                  <RefreshCw />
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : !accounts.length ? (
          <div className="flex flex-1 items-center justify-center p-4 md:p-8">
            <Empty className="max-w-xl border bg-white py-16 dark:bg-[#17201f]">
              <EmptyHeader>
                <EmptyMedia
                  variant="icon"
                  className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                >
                  <Home />
                </EmptyMedia>
                <EmptyTitle>连接你的第一个小米家庭</EmptyTitle>
                <EmptyDescription>
                  完成小米账号授权后，家庭、房间和设备会出现在这里。
                </EmptyDescription>
              </EmptyHeader>
              <Button
                type="button"
                onClick={() => void connectAccount()}
                loading={startOAuthMutation.isPending}
              >
                <Cloud />
                连接小米账号
              </Button>
              {import.meta.env.DEV ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void startLocalTokenLogin()}
                  loading={startOAuthMutation.isPending}
                >
                  <TerminalSquare />
                  本地脚本登录
                </Button>
              ) : null}
            </Empty>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <section className="border-b bg-white px-4 py-4 md:px-8 dark:bg-[#17201f]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value={activeAccount?.id || ""} onValueChange={setSelectedAccountId}>
                      <SelectTrigger className="h-10 w-full max-w-xs bg-transparent text-sm font-semibold sm:w-72">
                        <SelectValue placeholder="选择小米账号" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.label} · {account.cloudServerLabel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeAccount ? <AccountStatus account={activeAccount} /> : null}
                  </div>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>{activeAccount?.nickname || "小米账号"}</span>
                    <span>{activeAccount?.onlineDeviceCount || 0} 台在线</span>
                    <span>最近同步 {formatDate(activeAccount?.lastSyncAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeAccount?.lastError ? (
                    <span
                      className="text-destructive hidden max-w-56 truncate text-xs sm:block"
                      title={activeAccount.lastError}
                    >
                      {activeAccount.lastError}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => activeAccount && syncMutation.mutate(activeAccount.id)}
                    disabled={!activeAccount || syncMutation.isPending}
                  >
                    <RefreshCw className={cn(syncMutation.isPending && "animate-spin")} />
                    同步家庭
                  </Button>
                </div>
              </div>
            </section>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <aside className="shrink-0 border-b bg-[#eef2f1] px-4 py-4 md:w-60 md:border-r md:border-b-0 md:px-5 md:py-6 dark:bg-[#151d1c]">
                <div className="flex gap-3 overflow-x-auto md:block md:space-y-6 md:overflow-visible">
                  <div className="min-w-48 md:min-w-0">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                      <Home className="size-3.5" /> 家庭
                    </div>
                    <div className="space-y-1">
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                          selectedHomeId === "all"
                            ? "bg-white font-medium shadow-xs dark:bg-[#22302e]"
                            : "text-muted-foreground hover:bg-white/70 dark:hover:bg-[#22302e]/70",
                        )}
                        onClick={() => {
                          setSelectedHomeId("all");
                          setSelectedRoomId("all");
                        }}
                      >
                        <span>全部家庭</span>
                        <span className="text-xs tabular-nums">{devices.length}</span>
                      </button>
                      {homes.map((home) => (
                        <button
                          type="button"
                          key={home.id}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
                            selectedHomeId === home.id
                              ? "bg-white font-medium shadow-xs dark:bg-[#22302e]"
                              : "text-muted-foreground hover:bg-white/70 dark:hover:bg-[#22302e]/70",
                          )}
                          onClick={() => {
                            setSelectedHomeId(home.id);
                            setSelectedRoomId("all");
                          }}
                        >
                          <span className="min-w-0 truncate">{home.name}</span>
                          <span className="ml-2 text-xs tabular-nums">{home.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-48 md:min-w-0">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                      <DoorOpen className="size-3.5" /> 房间
                    </div>
                    <div className="flex gap-1 overflow-x-auto md:block md:space-y-1 md:overflow-visible">
                      <button
                        type="button"
                        className={cn(
                          "flex shrink-0 items-center justify-between rounded-md px-3 py-2 text-left text-sm md:w-full",
                          selectedRoomId === "all"
                            ? "bg-white font-medium shadow-xs dark:bg-[#22302e]"
                            : "text-muted-foreground hover:bg-white/70 dark:hover:bg-[#22302e]/70",
                        )}
                        onClick={() => setSelectedRoomId("all")}
                      >
                        全部房间
                      </button>
                      {rooms.map((room) => (
                        <button
                          type="button"
                          key={room.id}
                          className={cn(
                            "flex shrink-0 items-center justify-between rounded-md px-3 py-2 text-left text-sm md:w-full",
                            selectedRoomId === room.id
                              ? "bg-white font-medium shadow-xs dark:bg-[#22302e]"
                              : "text-muted-foreground hover:bg-white/70 dark:hover:bg-[#22302e]/70",
                          )}
                          onClick={() => setSelectedRoomId(room.id)}
                        >
                          <span className="max-w-32 truncate">{room.name}</span>
                          <span className="ml-2 text-xs tabular-nums">{room.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-56 md:min-w-0">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
                      <Boxes className="size-3.5" /> 类型
                    </div>
                    <div className="flex gap-1 overflow-x-auto md:block md:space-y-1 md:overflow-visible">
                      <button
                        type="button"
                        className={cn(
                          "flex shrink-0 items-center justify-between rounded-md px-3 py-2 text-left text-sm md:w-full",
                          selectedCategory === "all"
                            ? "bg-white font-medium shadow-xs dark:bg-[#22302e]"
                            : "text-muted-foreground hover:bg-white/70 dark:hover:bg-[#22302e]/70",
                        )}
                        onClick={() => setSelectedCategory("all")}
                      >
                        <span>全部类型</span>
                        <span className="text-xs tabular-nums">{devices.length}</span>
                      </button>
                      {categories.map(([category, value]) => {
                        const Icon = getDeviceIcon(category);
                        return (
                          <button
                            type="button"
                            key={category}
                            className={cn(
                              "flex shrink-0 items-center justify-between rounded-md px-3 py-2 text-left text-sm md:w-full",
                              selectedCategory === category
                                ? "bg-white font-medium shadow-xs dark:bg-[#22302e]"
                                : "text-muted-foreground hover:bg-white/70 dark:hover:bg-[#22302e]/70",
                            )}
                            onClick={() => setSelectedCategory(category)}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Icon className="size-3.5" />
                              <span className="truncate">{value.label}</span>
                            </span>
                            <span className="ml-2 text-xs tabular-nums">{value.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </aside>

              <main className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="flex flex-col gap-3 border-b bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6 dark:bg-[#17201f]">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold">设备</h2>
                      <Badge variant="outline" className="font-normal">
                        {visibleDevices.length}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      按 Home Assistant 设备类型整理
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                      <Input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder="搜索设备"
                        className="h-9 pl-9"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => devicesQuery.refetch()}
                      disabled={devicesQuery.isFetching}
                      aria-label="刷新设备列表"
                      title="刷新设备列表"
                    >
                      <RefreshCw className={cn(devicesQuery.isFetching && "animate-spin")} />
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                  {devicesQuery.isLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <Skeleton className="h-36 rounded-xl" />
                      <Skeleton className="h-36 rounded-xl" />
                      <Skeleton className="h-36 rounded-xl" />
                    </div>
                  ) : devicesQuery.isError ? (
                    <Alert variant="destructive">
                      <ShieldAlert />
                      <AlertTitle>设备加载失败</AlertTitle>
                      <AlertDescription>请同步家庭后重试。</AlertDescription>
                    </Alert>
                  ) : !visibleDevices.length ? (
                    <Empty className="min-h-72 border bg-white dark:bg-[#17201f]">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Boxes />
                        </EmptyMedia>
                        <EmptyTitle>{devices.length ? "没有匹配的设备" : "暂无设备"}</EmptyTitle>
                        <EmptyDescription>
                          {devices.length ? "尝试调整筛选条件。" : "点击同步家庭获取最新设备。"}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {visibleDevices.map((device) => {
                        const Icon = getDeviceIcon(device.category);
                        const preview = device.capabilities.find(
                          (capability) =>
                            capability.kind === "property" &&
                            capability.access?.includes("read") &&
                            getState(device, capability) !== undefined,
                        );
                        return (
                          <button
                            type="button"
                            key={device.id}
                            onClick={() => selectDevice(device.id)}
                            className={cn(
                              "group min-h-36 rounded-xl border bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none dark:bg-[#17201f]",
                              selectedDeviceId === device.id &&
                                "border-amber-400 ring-1 ring-amber-300",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-[#263532] dark:text-slate-200">
                                <Icon className="size-5" />
                              </span>
                              <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full",
                                    device.online ? "bg-emerald-500" : "bg-zinc-400",
                                  )}
                                />
                                {device.online ? "在线" : "离线"}
                              </span>
                            </div>
                            <div className="mt-4 flex items-end gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold">{device.name}</div>
                                <div className="text-muted-foreground mt-1 truncate text-xs">
                                  {device.roomName || device.homeName || "未分配房间"}
                                </div>
                              </div>
                              <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </div>
                            <div className="text-muted-foreground mt-3 flex items-center justify-between text-[11px]">
                              <span>{device.categoryLabel}</span>
                              {preview ? (
                                <span className="max-w-24 truncate tabular-nums">
                                  {formatState(getState(device, preview))}
                                  {preview.unit || ""}
                                </span>
                              ) : (
                                <span>{device.capabilities.length} 项能力</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </main>

              {!isMobile && detail ? (
                <aside className="flex w-[370px] shrink-0 flex-col border-l bg-white dark:bg-[#17201f]">
                  {detail}
                </aside>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {isMobile ? (
        <Sheet
          open={mobileDetailOpen && Boolean(detailDevice)}
          onOpenChange={(open) => {
            setMobileDetailOpen(open);
            if (!open) setSelectedDeviceId(undefined);
          }}
        >
          <SheetContent side="right" className="w-full max-w-none gap-0 p-0 sm:max-w-md">
            <SheetHeader className="sr-only">
              <SheetTitle>设备详情</SheetTitle>
              <SheetDescription>查看并控制设备状态</SheetDescription>
            </SheetHeader>
            {detail}
          </SheetContent>
        </Sheet>
      ) : null}

      <Dialog
        open={Boolean(localTokenStart)}
        onOpenChange={(open) => {
          if (!open) {
            setLocalTokenStart(null);
            setLocalCredentials("");
            setLocalCommandCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>本地脚本登录小米账号</DialogTitle>
            <DialogDescription>
              这是临时测试通道。脚本会在本机模拟 Home Assistant，完成小米登录后在本地页面生成凭据；
              BuildingAI 不会接收小米 OAuth 回调。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <TerminalSquare />
              <AlertTitle>1. 先在项目目录执行命令</AlertTitle>
              <AlertDescription>
                执行后会打开隔离浏览器。请在浏览器中登录小米账号并授权，回调完成后复制本地页面中的
                JSON。
              </AlertDescription>
            </Alert>
            <div className="relative">
              <Textarea
                readOnly
                value={localTokenCommand}
                rows={3}
                className="pr-12 font-mono text-xs leading-5"
                aria-label="本地小米登录命令"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute top-2 right-2"
                onClick={() => void copyLocalTokenCommand()}
                aria-label={localCommandCopied ? "已复制本地登录命令" : "复制本地登录命令"}
                title={localCommandCopied ? "已复制" : "复制命令"}
              >
                {localCommandCopied ? <Check /> : <Copy />}
              </Button>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">2. 粘贴本地页面生成的凭据</div>
              <Textarea
                value={localCredentials}
                onChange={(event) => setLocalCredentials(event.target.value)}
                rows={8}
                spellCheck={false}
                placeholder="粘贴完整 JSON，不要修改内容"
                className="font-mono text-xs leading-5"
                aria-label="小米本地登录凭据"
              />
              <p className="text-muted-foreground text-xs leading-5">
                导入时服务端会使用当前登录的 BuildingAI 账号验证 token
                并保存，凭据中的用户归属字段不会被信任。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLocalTokenStart(null);
                setLocalCredentials("");
                setLocalCommandCopied(false);
              }}
            >
              关闭
            </Button>
            <Button
              type="button"
              onClick={() => void importLocalCredentials()}
              loading={importCredentialsMutation.isPending}
              disabled={!localCredentials.trim()}
            >
              <Check />
              导入并同步家庭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
