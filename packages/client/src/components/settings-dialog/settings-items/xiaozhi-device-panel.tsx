import {
  fetchXiaozhiCaptcha,
  useAssignXiaozhiAgentMutation,
  useBindXiaozhiAccountMutation,
  useOrganizationMembersQuery,
  useReconnectXiaozhiAccountMutation,
  useRemoveXiaozhiAccountMutation,
  useSyncXiaozhiAccountMutation,
  type XiaozhiAccount,
  useUpdateXiaozhiAccountMutation,
  useXiaozhiAccountsQuery,
  type XiaozhiAgent,
  useXiaozhiAgentsQuery,
} from "@buildingai/services/web";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Input } from "@buildingai/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { Bot, Link2, LoaderCircle, Pencil, PlugZap, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { XiaozhiAgentDialog } from "./xiaozhi-agent-dialog";

type CaptchaState = { challengeId: string; image: string } | null;

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Bot;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-t text-center">
      <Icon className="text-muted-foreground size-7" />
      <p className="font-medium">{title}</p>
      {detail ? <p className="text-muted-foreground max-w-sm text-xs">{detail}</p> : null}
    </div>
  );
}

/**
 * Organization-only asset panel for teachers and administrators. Student
 * device access uses CubeCatDeviceManager and never renders account data.
 */
export function XiaozhiDevicePanel({
  organizationId,
  canManageAssets,
  canReadMembers,
}: {
  organizationId: string | null;
  canManageAssets: boolean;
  canReadMembers: boolean;
}) {
  const canManage = Boolean(organizationId && canManageAssets);
  const [xiaozhiOpen, setXiaozhiOpen] = useState(false);
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaState>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [xiaozhiForm, setXiaozhiForm] = useState({
    label: "",
    username: "",
    password: "",
    captchaCode: "",
  });
  const [accountRename, setAccountRename] = useState<{ id: string; label: string } | null>(null);
  const [reconnectTarget, setReconnectTarget] = useState<XiaozhiAccount | null>(null);
  const [reconnectForm, setReconnectForm] = useState({
    username: "",
    password: "",
    captchaCode: "",
  });

  const { data: accounts = [], isLoading: accountsLoading } = useXiaozhiAccountsQuery({
    enabled: canManage,
  });
  const { data: agents = [], isLoading: agentsLoading } = useXiaozhiAgentsQuery({
    enabled: Boolean(organizationId),
  });
  // Resolve from the live list so the dialog reflects mutations (e.g. a
  // fresh agent link) without being reopened.
  const detailAgent = agents.find((agent) => agent.id === detailAgentId) || null;
  // The distribution picker must always offer every member of the organization.
  const { data: members = [] } = useOrganizationMembersQuery(organizationId, "", {
    enabled: Boolean(organizationId && canReadMembers),
  });

  const deviceSummary = useMemo(
    () => ({
      accounts: accounts.length,
      agents: agents.length,
      devices: agents.reduce((sum, agent) => sum + agent.deviceCount, 0),
      online: agents.reduce((sum, agent) => sum + agent.onlineDeviceCount, 0),
    }),
    [accounts, agents],
  );

  const bindXiaozhi = useBindXiaozhiAccountMutation({
    onSuccess: () => {
      toast.success("CubeCat 账号已绑定并完成同步");
      setXiaozhiOpen(false);
      setCaptcha(null);
      setXiaozhiForm({ label: "", username: "", password: "", captchaCode: "" });
    },
  });
  const syncAccount = useSyncXiaozhiAccountMutation({
    onSuccess: () => toast.success("智能体已同步"),
  });
  const assignAgent = useAssignXiaozhiAgentMutation({
    onSuccess: () => toast.success("分发状态已更新"),
  });
  const reconnectXiaozhi = useReconnectXiaozhiAccountMutation({
    onSuccess: () => {
      toast.success("CubeCat 账号已重新连接");
      setReconnectTarget(null);
      setReconnectForm({ username: "", password: "", captchaCode: "" });
      setCaptcha(null);
    },
  });
  const updateXiaozhiAccount = useUpdateXiaozhiAccountMutation({
    onSuccess: () => {
      toast.success("账号备注已更新");
      setAccountRename(null);
    },
  });
  const removeXiaozhiAccount = useRemoveXiaozhiAccountMutation({
    onSuccess: () => toast.success("已移除CubeCat 账号"),
  });

  async function refreshCaptcha() {
    setCaptchaLoading(true);
    try {
      setCaptcha(await fetchXiaozhiCaptcha(organizationId));
    } finally {
      setCaptchaLoading(false);
    }
  }

  function openXiaozhiDialog() {
    setXiaozhiOpen(true);
    void refreshCaptcha();
  }

  function openReconnectDialog(account: XiaozhiAccount) {
    setReconnectTarget(account);
    setReconnectForm({ username: "", password: "", captchaCode: "" });
    void refreshCaptcha();
  }

  function removeAccount(account: XiaozhiAccount) {
    if (
      !window.confirm(
        `确定移除CubeCat 账号「${account.label}」吗？只解除本系统的绑定，CubeCat 控制台里的智能体和设备不受影响。`,
      )
    ) {
      return;
    }
    removeXiaozhiAccount.mutate(account.id);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">CubeCat 设备</p>
          <p className="text-muted-foreground text-xs">
            组织绑定的CubeCat 账号会同步智能体；每个智能体下可以包含多台设备并分配给一名成员。
          </p>
        </div>
        {canManage && (
          <Button onClick={openXiaozhiDialog}>
            <Link2 /> 绑定CubeCat 账号
          </Button>
        )}
      </div>
      {agents.length ? (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ...(canManage ? ([["绑定账号", deviceSummary.accounts]] as const) : []),
              ["智能体", deviceSummary.agents],
              ["设备总数", deviceSummary.devices],
              ["在线设备", deviceSummary.online],
            ] as const
          ).map(([label, value]) => (
            <div className="border px-3 py-2" key={label}>
              <p className="text-muted-foreground text-xs">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
      {canManage && accounts.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {accounts.map((account) => (
            <div className="flex items-center gap-2 border px-2 py-1.5 text-xs" key={account.id}>
              <span
                className={
                  account.status === "active"
                    ? "size-2 rounded-full bg-emerald-500"
                    : "size-2 rounded-full bg-red-500"
                }
                title={account.lastError || undefined}
              />
              <span>{account.label}</span>
              <span className="text-muted-foreground">{account.usernameMasked}</span>
              {account.credentialStatus === "recovery_required" ? (
                <span className="text-amber-600">需恢复</span>
              ) : null}
              <Button
                size="icon-xs"
                variant="ghost"
                title="同步智能体"
                loading={syncAccount.isPending}
                onClick={() => syncAccount.mutate(account.id)}
              >
                <RefreshCw />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                title="重新登录"
                onClick={() => openReconnectDialog(account)}
              >
                <PlugZap />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                title="编辑备注"
                onClick={() => setAccountRename({ id: account.id, label: account.label })}
              >
                <Pencil />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                title="移除账号"
                loading={removeXiaozhiAccount.isPending}
                onClick={() => removeAccount(account)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {accountsLoading || agentsLoading ? (
        <EmptyState icon={LoaderCircle} title="正在读取智能体" detail="" />
      ) : agents.length ? (
        <div className="max-h-[350px] overflow-auto border-y">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>智能体</TableHead>
                <TableHead>设备</TableHead>
                {organizationId ? <TableHead>分发账号</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left"
                      onClick={() => setDetailAgentId(agent.id)}
                    >
                      <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                        <Bot className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-muted-foreground text-xs">
                          智能体 #{agent.upstreamAgentId}
                        </p>
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setDetailAgentId(agent.id)}
                    >
                      <span>{agent.deviceCount} 台</span>
                      <span className="ml-2 text-xs text-emerald-600">
                        {agent.onlineDeviceCount} 在线
                      </span>
                    </button>
                  </TableCell>
                  {organizationId ? (
                    <TableCell>
                      {canManageAssets ? (
                        <Select
                          value={agent.assignedUserId || "unassigned"}
                          onValueChange={(value) =>
                            assignAgent.mutate({
                              agentId: agent.id,
                              assignedUserId: value === "unassigned" ? null : value,
                            })
                          }
                        >
                          <SelectTrigger className="w-44">
                            <SelectValue placeholder="未分发" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">未分发</SelectItem>
                            {members.map((member) => (
                              <SelectItem value={member.userId} key={member.userId}>
                                {member.realName || member.nickname} · {member.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">分配给我</span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={Bot}
          title="暂无 CubeCat"
          detail={
            canManage
              ? "绑定CubeCat 控制台账号后，系统会按智能体同步设备。"
              : organizationId
                ? "当前组织身份没有管理 CubeCat 设备的权限。"
                : "请先切换到需要管理设备的组织工作空间。"
          }
        />
      )}

      <XiaozhiAgentDialog
        agent={detailAgent}
        canManage={canManage}
        open={Boolean(detailAgent)}
        onOpenChange={(next) => {
          if (!next) setDetailAgentId(null);
        }}
      />

      <Dialog
        open={Boolean(accountRename)}
        onOpenChange={(next) => {
          if (!next) setAccountRename(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑账号备注</DialogTitle>
            <DialogDescription>备注只用于在本系统里区分多个CubeCat 账号。</DialogDescription>
          </DialogHeader>
          <Input
            value={accountRename?.label || ""}
            maxLength={40}
            onChange={(event) =>
              accountRename && setAccountRename({ ...accountRename, label: event.target.value })
            }
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountRename(null)}>
              取消
            </Button>
            <Button
              loading={updateXiaozhiAccount.isPending}
              disabled={!accountRename?.label.trim()}
              onClick={() =>
                accountRename &&
                updateXiaozhiAccount.mutate({
                  accountId: accountRename.id,
                  label: accountRename.label.trim(),
                })
              }
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reconnectTarget)}
        onOpenChange={(next) => {
          if (!next) setReconnectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重新登录CubeCat 账号</DialogTitle>
            <DialogDescription>
              {reconnectTarget
                ? reconnectTarget.credentialStatus === "recovery_required"
                  ? `「${reconnectTarget.label}」的旧凭据无法解密，请重新填写CubeCat 用户名和密码。成功后会原地恢复，不影响已有设备分配。`
                  : `为「${reconnectTarget.label}」（${reconnectTarget.usernameMasked}）重新获取登录会话。用户名和密码留空则使用已保存的凭据。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={reconnectForm.username}
              onChange={(event) =>
                setReconnectForm({ ...reconnectForm, username: event.target.value })
              }
              placeholder={
                reconnectTarget?.credentialStatus === "recovery_required"
                  ? "CubeCat 用户名"
                  : "CubeCat 用户名（可选）"
              }
            />
            <Input
              type="password"
              value={reconnectForm.password}
              onChange={(event) =>
                setReconnectForm({ ...reconnectForm, password: event.target.value })
              }
              placeholder={
                reconnectTarget?.credentialStatus === "recovery_required"
                  ? "CubeCat 密码"
                  : "CubeCat 密码（可选）"
              }
            />
            <div className="flex items-stretch gap-2">
              <div className="bg-muted flex h-10 min-w-32 items-center justify-center overflow-hidden border">
                {captchaLoading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : captcha ? (
                  <img className="max-h-full max-w-full" src={captcha.image} alt="图形验证码" />
                ) : (
                  <span className="text-muted-foreground text-xs">验证码不可用</span>
                )}
              </div>
              <Button size="icon" variant="outline" title="刷新验证码" onClick={refreshCaptcha}>
                <RefreshCw />
              </Button>
              <Input
                className="min-w-0 flex-1"
                value={reconnectForm.captchaCode}
                onChange={(event) =>
                  setReconnectForm({ ...reconnectForm, captchaCode: event.target.value })
                }
                placeholder="验证码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconnectTarget(null)}>
              取消
            </Button>
            <Button
              loading={reconnectXiaozhi.isPending}
              disabled={
                !captcha ||
                !reconnectForm.captchaCode.trim() ||
                (reconnectTarget?.credentialStatus === "recovery_required" &&
                  (!reconnectForm.username.trim() || !reconnectForm.password))
              }
              onClick={() =>
                captcha &&
                reconnectTarget &&
                reconnectXiaozhi.mutate({
                  accountId: reconnectTarget.id,
                  username: reconnectForm.username.trim() || undefined,
                  password: reconnectForm.password || undefined,
                  captchaCode: reconnectForm.captchaCode.trim(),
                  challengeId: captcha.challengeId,
                })
              }
            >
              重新登录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={xiaozhiOpen} onOpenChange={setXiaozhiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>绑定CubeCat 账号</DialogTitle>
            <DialogDescription>
              仅老师和组织管理员可操作。凭据加密保存在当前组织，并用于同步智能体与设备。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={xiaozhiForm.label}
              onChange={(event) => setXiaozhiForm({ ...xiaozhiForm, label: event.target.value })}
              placeholder="账号备注"
            />
            <Input
              value={xiaozhiForm.username}
              onChange={(event) => setXiaozhiForm({ ...xiaozhiForm, username: event.target.value })}
              placeholder="CubeCat 用户名"
            />
            <Input
              type="password"
              value={xiaozhiForm.password}
              onChange={(event) => setXiaozhiForm({ ...xiaozhiForm, password: event.target.value })}
              placeholder="CubeCat 密码"
            />
            <div className="flex items-stretch gap-2">
              <div className="bg-muted flex h-10 min-w-32 items-center justify-center overflow-hidden border">
                {captchaLoading ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : captcha ? (
                  <img className="max-h-full max-w-full" src={captcha.image} alt="图形验证码" />
                ) : (
                  <span className="text-muted-foreground text-xs">验证码不可用</span>
                )}
              </div>
              <Button size="icon" variant="outline" title="刷新验证码" onClick={refreshCaptcha}>
                <RefreshCw />
              </Button>
              <Input
                className="min-w-0 flex-1"
                value={xiaozhiForm.captchaCode}
                onChange={(event) =>
                  setXiaozhiForm({ ...xiaozhiForm, captchaCode: event.target.value })
                }
                placeholder="验证码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setXiaozhiOpen(false)}>
              取消
            </Button>
            <Button
              loading={bindXiaozhi.isPending}
              disabled={!captcha}
              onClick={() =>
                captcha &&
                bindXiaozhi.mutate({
                  ...xiaozhiForm,
                  challengeId: captcha.challengeId,
                })
              }
            >
              绑定并同步
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
