import {
  useBindXiaozhiDeviceMutation,
  useDeleteXiaozhiAgentMutation,
  useRenameXiaozhiAgentMutation,
  useUnbindXiaozhiDeviceMutation,
  useUpdateXiaozhiAgentConfigMutation,
  useUpdateXiaozhiDeviceAliasMutation,
  useUpdateXiaozhiDeviceAutoUpdateMutation,
  useXiaozhiAgentChatsQuery,
  useXiaozhiAgentEditorQuery,
  useXiaozhiChatMessagesQuery,
  useXiaozhiDevicesQuery,
  type XiaozhiAgent,
  type XiaozhiAgentConfig,
  type XiaozhiAgentEditorData,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Switch } from "@buildingai/ui/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import {
  ArrowLeft,
  Cpu,
  LoaderCircle,
  MessageSquare,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AgentConfigFields,
  configToForm,
  type EditorForm,
  formToConfig,
  validateForm,
} from "./agent-config-form";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "—" : new Date(parsed).toLocaleString();
}

export function XiaozhiAgentDialog({
  agent,
  canManage,
  open,
  onOpenChange,
}: {
  agent: XiaozhiAgent | null;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const agentId = agent?.id ?? null;
  const [tab, setTab] = useState("devices");
  const [verificationCode, setVerificationCode] = useState("");
  const [aliasDraft, setAliasDraft] = useState<{ deviceId: number; value: string } | null>(null);
  const [form, setForm] = useState<EditorForm | null>(null);
  const [agentName, setAgentName] = useState("");
  const [activeChatId, setActiveChatId] = useState<number | null>(null);

  const { data: devices = [], isLoading: devicesLoading } = useXiaozhiDevicesQuery(agentId, {
    enabled: open && tab === "devices",
  });
  const { data: editorData, isLoading: editorLoading } = useXiaozhiAgentEditorQuery(agentId, {
    enabled: open && tab === "config",
  });
  const { data: chats = [], isLoading: chatsLoading } = useXiaozhiAgentChatsQuery(agentId, {
    enabled: open && tab === "history",
  });
  const { data: messages = [], isLoading: messagesLoading } = useXiaozhiChatMessagesQuery(
    agentId,
    activeChatId,
    { enabled: open && tab === "history" && activeChatId !== null },
  );

  useEffect(() => {
    if (!open) return;
    setTab("devices");
    setVerificationCode("");
    setAliasDraft(null);
    setActiveChatId(null);
    setForm(null);
  }, [open, agentId]);

  useEffect(() => {
    if (!editorData || !agent) return;
    setForm(configToForm(editorData.config, editorData));
    setAgentName(editorData.config.agent_name || agent.name);
  }, [agent, editorData]);

  const bindDevice = useBindXiaozhiDeviceMutation({
    onSuccess: () => {
      toast.success("设备已绑定到该智能体");
      setVerificationCode("");
    },
  });
  const updateAlias = useUpdateXiaozhiDeviceAliasMutation({
    onSuccess: () => {
      toast.success("设备备注已更新");
      setAliasDraft(null);
    },
  });
  const updateAutoUpdate = useUpdateXiaozhiDeviceAutoUpdateMutation({
    onSuccess: () => toast.success("自动升级设置已更新"),
  });
  const unbindDevice = useUnbindXiaozhiDeviceMutation({
    onSuccess: () => toast.success("设备已解绑"),
  });
  const renameAgent = useRenameXiaozhiAgentMutation();
  const updateConfig = useUpdateXiaozhiAgentConfigMutation();
  const deleteAgent = useDeleteXiaozhiAgentMutation({
    onSuccess: () => {
      toast.success("智能体已删除");
      onOpenChange(false);
    },
  });

  function confirmDeleteAgent() {
    if (!agent) return;
    if (
      !window.confirm(
        `确定删除智能体「${agent.name}」吗？会同时在小智控制台删除该智能体，此操作无法撤销。`,
      )
    ) {
      return;
    }
    deleteAgent.mutate(agent.id);
  }

  async function saveConfig() {
    if (!agent || !form || !editorData) return;
    if (!agentName.trim()) {
      toast.error("智能体名称不能为空");
      return;
    }
    const formError = validateForm(form);
    if (formError) {
      toast.error(formError);
      return;
    }

    try {
      await updateConfig.mutateAsync({
        agentId: agent.id,
        config: formToConfig(form, editorData),
      });
      if (agentName.trim() !== agent.name) {
        await renameAgent.mutateAsync({ agentId: agent.id, name: agentName.trim() });
      }
      toast.success("智能体配置已保存");
    } catch {
      // The shared HTTP client already surfaces the upstream failure message.
    }
  }

  if (!agent) return null;
  const saving = updateConfig.isPending || renameAgent.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{agent.name}</DialogTitle>
          <DialogDescription>
            智能体 #{agent.upstreamAgentId} · {agent.deviceCount} 台设备 · {agent.onlineDeviceCount}{" "}
            在线
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="devices">
              <Cpu /> 设备
            </TabsTrigger>
            <TabsTrigger value="config">
              <SlidersHorizontal /> 角色配置
            </TabsTrigger>
            <TabsTrigger value="history">
              <MessageSquare /> 对话记录
            </TabsTrigger>
          </TabsList>

          <TabsContent value="devices">
            {canManage ? (
              <div className="mb-3 flex items-end gap-2">
                <div className="flex-1">
                  <Label className="mb-1.5" htmlFor="xiaozhi-verification-code">
                    设备验证码
                  </Label>
                  <Input
                    id="xiaozhi-verification-code"
                    placeholder="方糖猫开机后播报的 6 位验证码"
                    value={verificationCode}
                    maxLength={16}
                    onChange={(event) => setVerificationCode(event.target.value.trim())}
                  />
                </div>
                <Button
                  loading={bindDevice.isPending}
                  disabled={verificationCode.length < 4}
                  onClick={() => bindDevice.mutate({ agentId: agent.id, verificationCode })}
                >
                  <Plus /> 绑定设备
                </Button>
              </div>
            ) : null}

            {devicesLoading ? (
              <div className="flex min-h-40 items-center justify-center">
                <LoaderCircle className="size-5 animate-spin" />
              </div>
            ) : devices.length ? (
              <div className="max-h-[320px] overflow-auto border-y">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>设备</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>自动升级</TableHead>
                      {canManage ? <TableHead className="w-16" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          {aliasDraft?.deviceId === device.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                autoFocus
                                value={aliasDraft.value}
                                maxLength={80}
                                onChange={(event) =>
                                  setAliasDraft({
                                    deviceId: device.id,
                                    value: event.target.value,
                                  })
                                }
                              />
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                title="保存备注"
                                loading={updateAlias.isPending}
                                onClick={() =>
                                  updateAlias.mutate({
                                    agentId: agent.id,
                                    deviceId: device.id,
                                    macAddress: device.macAddress,
                                    alias: aliasDraft.value,
                                  })
                                }
                              >
                                <Save />
                              </Button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-left"
                              disabled={!canManage}
                              onClick={() =>
                                setAliasDraft({ deviceId: device.id, value: device.alias })
                              }
                            >
                              <p className="font-medium">
                                {device.alias || device.macAddress || `设备 #${device.id}`}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {device.boardName || "未知型号"} · {device.macAddress}
                              </p>
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={device.online ? "default" : "secondary"}>
                              {device.online ? "在线" : "离线"}
                            </Badge>
                            {device.authorized ? null : <Badge variant="outline">未激活</Badge>}
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {formatDateTime(device.lastConnectedAt)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={device.autoUpdate}
                            disabled={!canManage || updateAutoUpdate.isPending}
                            onCheckedChange={(checked) =>
                              updateAutoUpdate.mutate({
                                agentId: agent.id,
                                deviceId: device.id,
                                macAddress: device.macAddress,
                                autoUpdate: checked,
                              })
                            }
                          />
                        </TableCell>
                        {canManage ? (
                          <TableCell>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              title="解绑设备"
                              loading={unbindDevice.isPending}
                              onClick={() =>
                                unbindDevice.mutate({ agentId: agent.id, deviceId: device.id })
                              }
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-y text-center">
                <Cpu className="text-muted-foreground size-7" />
                <p className="font-medium">该智能体下暂无设备</p>
                <p className="text-muted-foreground max-w-sm text-xs">
                  {canManage
                    ? "方糖猫开机后会播报验证码，填入上方即可绑定到当前智能体。"
                    : "等待管理员为这个角色绑定方糖猫设备。"}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="config">
            {editorLoading || !form || !editorData ? (
              <div className="flex min-h-60 items-center justify-center">
                <LoaderCircle className="size-5 animate-spin" />
              </div>
            ) : (
              <div className="max-h-[380px] space-y-4 overflow-auto pr-1">
                <div>
                  <Label className="mb-1.5" htmlFor="xiaozhi-agent-name">
                    智能体名称
                  </Label>
                  <Input
                    id="xiaozhi-agent-name"
                    value={agentName}
                    maxLength={40}
                    disabled={!canManage}
                    onChange={(event) => setAgentName(event.target.value)}
                  />
                </div>

                <AgentConfigFields
                  form={form}
                  setForm={setForm}
                  resources={editorData}
                  disabled={!canManage}
                />

                {canManage ? (
                  <div className="flex items-center justify-between border-t pt-3">
                    <Button
                      variant="ghost"
                      className="text-destructive"
                      loading={deleteAgent.isPending}
                      onClick={confirmDeleteAgent}
                    >
                      <Trash2 /> 删除智能体
                    </Button>
                    <Button loading={saving} onClick={saveConfig}>
                      <Save /> 保存配置
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground border-t pt-3 text-xs">
                    只有组织的老师或管理员可以修改角色配置。
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {activeChatId === null ? (
              chatsLoading ? (
                <div className="flex min-h-40 items-center justify-center">
                  <LoaderCircle className="size-5 animate-spin" />
                </div>
              ) : chats.length ? (
                <div className="max-h-[360px] divide-y overflow-auto border-y">
                  {chats.map((chat) => (
                    <button
                      type="button"
                      key={chat.id}
                      className="hover:bg-muted/60 flex w-full flex-col gap-1 px-3 py-2.5 text-left"
                      onClick={() => setActiveChatId(chat.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{chat.title}</p>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {formatDateTime(chat.createdAt)}
                        </span>
                      </div>
                      {chat.summary ? (
                        <p className="text-muted-foreground line-clamp-2 text-xs">{chat.summary}</p>
                      ) : null}
                      <p className="text-muted-foreground text-xs">
                        {chat.messageCount} 条消息 · {chat.model || "未知模型"}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-y text-center">
                  <MessageSquare className="text-muted-foreground size-7" />
                  <p className="font-medium">暂无对话记录</p>
                  <p className="text-muted-foreground max-w-sm text-xs">
                    方糖猫与学生产生对话后，这里会显示历史会话。
                  </p>
                </div>
              )
            ) : (
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mb-2"
                  onClick={() => setActiveChatId(null)}
                >
                  <ArrowLeft /> 返回会话列表
                </Button>
                {messagesLoading ? (
                  <div className="flex min-h-40 items-center justify-center">
                    <LoaderCircle className="size-5 animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-[320px] space-y-3 overflow-auto border-y px-3 py-3">
                    {messages.length ? (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={
                            message.role === "user"
                              ? "flex flex-col items-end gap-1"
                              : "flex flex-col items-start gap-1"
                          }
                        >
                          <span className="text-muted-foreground text-xs">
                            {message.role === "user" ? "学生" : message.name || "方糖猫"} ·{" "}
                            {formatDateTime(message.createdAt)}
                          </span>
                          <div
                            className={
                              message.role === "user"
                                ? "bg-primary text-primary-foreground max-w-[80%] rounded-md px-3 py-2 text-sm"
                                : "bg-muted max-w-[80%] rounded-md px-3 py-2 text-sm"
                            }
                          >
                            {message.content || "（无文本内容）"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground py-6 text-center text-xs">
                        这段会话没有可显示的消息。
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
