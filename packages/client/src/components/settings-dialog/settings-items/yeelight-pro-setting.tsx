import {
  pollYeelightProQr,
  useRemoveYeelightProAccountMutation,
  useSelectYeelightProHouseMutation,
  useStartYeelightProQrMutation,
  useSyncYeelightProAccountMutation,
  useUpdateYeelightProAccountMutation,
  useYeelightProAccountsQuery,
  YEELIGHT_PRO_REGIONS,
  type YeelightProAccount,
  type YeelightProQrPoll,
  type YeelightProQrStart,
  type YeelightProRegion,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { cn } from "@buildingai/ui/lib/utils";
import {
  CircleAlert,
  CircleCheck,
  Lightbulb,
  Pencil,
  QrCode,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SettingItem, SettingItemGroup } from "../setting-item";

const SCAN_STATUS_LABELS: Record<string, string> = {
  CREATED: "等待扫码",
  SCANNED: "已扫码，请在 APP 中确认",
  CONFIRM: "请在 APP 中确认授权",
  LOGIN: "登录成功",
  EXPIRED: "二维码已过期",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "尚未同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function YeelightProSetting() {
  const { confirm } = useAlertDialog();
  const [region, setRegion] = useState<YeelightProRegion>("cn");
  const [qrStart, setQrStart] = useState<YeelightProQrStart | null>(null);
  const [qrPoll, setQrPoll] = useState<YeelightProQrPoll | null>(null);
  const [houseAccount, setHouseAccount] = useState<YeelightProAccount | null>(null);
  const [houses, setHouses] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedHouseId, setSelectedHouseId] = useState("");
  const [editingAccount, setEditingAccount] = useState<YeelightProAccount | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const accountsQuery = useYeelightProAccountsQuery();
  const accounts = accountsQuery.data || [];
  const startQrMutation = useStartYeelightProQrMutation();
  const selectHouseMutation = useSelectYeelightProHouseMutation({
    onSuccess: () => {
      setHouseAccount(null);
      setHouses([]);
      toast.success("易来家庭已绑定并完成同步");
    },
    onError: (error) => toast.error(error.message || "家庭绑定失败"),
  });
  const syncMutation = useSyncYeelightProAccountMutation({
    onSuccess: () => toast.success("家庭与彩光灯已同步"),
    onError: (error) => toast.error(error.message || "同步失败"),
  });
  const updateMutation = useUpdateYeelightProAccountMutation({
    onSuccess: () => {
      setEditingAccount(null);
      toast.success("账号名称已更新");
    },
    onError: (error) => toast.error(error.message || "账号名称更新失败"),
  });
  const removeMutation = useRemoveYeelightProAccountMutation({
    onSuccess: () => toast.success("易来账号已解绑"),
    onError: (error) => toast.error(error.message || "账号解绑失败"),
  });

  useEffect(() => {
    if (!qrStart || qrPoll?.status === "LOGIN") return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void pollYeelightProQr(qrStart.sessionId)
        .then((result) => {
          if (cancelled) return;
          setQrPoll(result);
          if (result.status !== "LOGIN" || !result.account) return;
          window.clearInterval(timer);
          setQrStart(null);
          void accountsQuery.refetch();
          if (result.houses.length > 1 && !result.account.houseId) {
            setHouseAccount(result.account);
            setHouses(result.houses);
            setSelectedHouseId(result.houses[0]?.id || "");
            toast.success("扫码成功，请选择要同步的家庭");
            return;
          }
          toast.success("易来账号已连接并完成同步");
        })
        .catch((error) => {
          if (cancelled) return;
          window.clearInterval(timer);
          setQrStart(null);
          toast.error(error instanceof Error ? error.message : "扫码登录失败");
        });
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accountsQuery, qrPoll?.status, qrStart]);

  const startQrLogin = async () => {
    try {
      const result = await startQrMutation.mutateAsync(region);
      setQrStart(result);
      setQrPoll(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法生成易来登录二维码");
    }
  };

  const syncAccount = async (accountId: string) => {
    setSyncingId(accountId);
    try {
      await syncMutation.mutateAsync(accountId);
    } finally {
      setSyncingId(null);
    }
  };

  const removeAccount = async (account: YeelightProAccount) => {
    try {
      await confirm({
        title: "解绑易来账号？",
        description: `解绑“${account.label}”后，该账号下已同步的彩光灯会从系统中移除。`,
        confirmText: "确认解绑",
        confirmVariant: "destructive",
      });
    } catch {
      return;
    }
    setRemovingId(account.id);
    try {
      await removeMutation.mutateAsync(account.id);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingItemGroup label="易来 Pro 云端">
        <SettingItem
          icon={<Lightbulb className="size-5" />}
          title="易来彩光灯"
          description="仅接入 Yeelight Pro 云端。用易来 APP 1.5.0 及以上，在首页右上角 + 选择 MCP 授权后扫描二维码。"
          className="flex-col items-stretch gap-3 sm:flex-row sm:items-center"
          contentClassName="min-w-0"
        >
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Select value={region} onValueChange={(value) => setRegion(value as YeelightProRegion)}>
              <SelectTrigger className="bg-background w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEELIGHT_PRO_REGIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={() => void startQrLogin()}
              loading={startQrMutation.isPending}
            >
              <QrCode />
              扫码添加账号
            </Button>
          </div>
        </SettingItem>
      </SettingItemGroup>

      <SettingItemGroup label="已连接易来账号">
        {accountsQuery.isLoading ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : accountsQuery.isError ? (
          <div className="p-4">
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>易来账号加载失败</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>请检查网络连接后重试。</span>
                <Button variant="outline" size="sm" onClick={() => accountsQuery.refetch()}>
                  <RefreshCw />
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : accounts.length ? (
          accounts.map((account) => (
            <SettingItem
              key={account.id}
              icon={
                <span className="bg-background flex size-9 items-center justify-center rounded-md border">
                  <Lightbulb className="size-4" />
                </span>
              }
              title={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{account.label}</span>
                  <Badge
                    variant="outline"
                    className={cn(account.status === "active" && "text-emerald-600")}
                  >
                    {account.status === "active" ? <CircleCheck /> : <CircleAlert />}
                    {account.status === "active"
                      ? "连接正常"
                      : account.status === "auth_error"
                        ? "授权已失效"
                        : "同步异常"}
                  </Badge>
                </div>
              }
              description={`${account.regionLabel} · ${account.houseName || "未选择家庭"} · ${account.deviceCount} 台彩光灯`}
              extra={
                account.lastError
                  ? `最近错误：${account.lastError}`
                  : `最近同步：${formatDate(account.lastSyncAt)}`
              }
              className="flex-col items-stretch gap-3 py-4 sm:flex-row sm:items-center"
              contentClassName="min-w-0 flex-1"
            >
              <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void syncAccount(account.id)}
                  disabled={syncMutation.isPending}
                  aria-label={`同步${account.label}`}
                  title="同步家庭与彩光灯"
                >
                  <RefreshCw className={cn(syncingId === account.id && "animate-spin")} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setEditingAccount(account);
                    setAccountLabel(account.label);
                  }}
                  aria-label={`修改${account.label}的名称`}
                  title="修改名称"
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void removeAccount(account)}
                  disabled={removeMutation.isPending}
                  aria-label={`解绑${account.label}`}
                  title="解绑账号"
                >
                  <Trash2 className={cn(removingId === account.id && "animate-pulse")} />
                </Button>
              </div>
            </SettingItem>
          ))
        ) : (
          <Empty className="min-h-40 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Lightbulb />
              </EmptyMedia>
              <EmptyTitle>尚未连接易来账号</EmptyTitle>
              <EmptyDescription>选择云区后扫码，即可同步彩光灯泡。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </SettingItemGroup>

      <Dialog
        open={Boolean(qrStart)}
        onOpenChange={(open) => {
          if (!open) {
            setQrStart(null);
            setQrPoll(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>扫码登录易来账号</DialogTitle>
            <DialogDescription>
              打开易来 APP，首页右上角点 +，选择「MCP 授权」，扫描下方二维码。不要使用添加设备入口。
            </DialogDescription>
          </DialogHeader>
          {qrStart ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={qrStart.qrcodeDataUrl}
                  alt="易来扫码登录二维码"
                  width={280}
                  height={280}
                  className="rounded-lg border bg-white p-2"
                />
              </div>
              <Alert>
                <QrCode />
                <AlertTitle>{SCAN_STATUS_LABELS[qrPoll?.status || qrStart.status]}</AlertTitle>
                <AlertDescription>
                  二维码约 5 分钟有效。当前区域：{qrStart.regionLabel}。
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setQrStart(null);
                setQrPoll(null);
              }}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(houseAccount)}
        onOpenChange={(open) => {
          if (!open) {
            setHouseAccount(null);
            setHouses([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>选择易来家庭</DialogTitle>
            <DialogDescription>该账号有多个家庭，请选择要同步彩光灯的那一个。</DialogDescription>
          </DialogHeader>
          <Select value={selectedHouseId} onValueChange={setSelectedHouseId}>
            <SelectTrigger>
              <SelectValue placeholder="选择家庭" />
            </SelectTrigger>
            <SelectContent>
              {houses.map((house) => (
                <SelectItem key={house.id} value={house.id}>
                  {house.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHouseAccount(null)}>
              稍后
            </Button>
            <Button
              disabled={!houseAccount || !selectedHouseId}
              loading={selectHouseMutation.isPending}
              onClick={() =>
                houseAccount &&
                selectHouseMutation.mutate({
                  accountId: houseAccount.id,
                  houseId: selectedHouseId,
                })
              }
            >
              绑定并同步
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingAccount)}
        onOpenChange={(open) => !open && setEditingAccount(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>修改账号名称</DialogTitle>
            <DialogDescription>名称只用于在 BuildingAI 中区分不同的易来账号。</DialogDescription>
          </DialogHeader>
          <Input
            value={accountLabel}
            onChange={(event) => setAccountLabel(event.target.value)}
            maxLength={80}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccount(null)}>
              取消
            </Button>
            <Button
              loading={updateMutation.isPending}
              disabled={!accountLabel.trim()}
              onClick={() =>
                editingAccount &&
                updateMutation.mutate({
                  accountId: editingAccount.id,
                  label: accountLabel.trim(),
                })
              }
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
