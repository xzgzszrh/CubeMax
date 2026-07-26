import { apiHttpClient } from "@buildingai/services";
import {
  getActiveOrganizationId,
  OrganizationPermission,
  useWorkspaceContextQuery,
  useXiaozhiAgentsQuery,
  useXiaozhiScenesQuery,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
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
import { Slider } from "@buildingai/ui/components/ui/slider";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  LayoutGrid,
  ListOrdered,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  Radio,
  Send,
  Square,
  Timer,
  Trash2,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// 类型与本地 hooks
// organization.ts（共享服务层）由其他改动占用，课堂相关的类型和请求先内聚在
// 本文件；后续可以原样搬到 @buildingai/services/web/organization.ts。
// ---------------------------------------------------------------------------

export type ClassroomDisplayLayout = "grid" | "leaderboard" | "timeline";

export type ClassroomDisplayConfig = {
  title: string;
  subtitle: string;
  layout: ClassroomDisplayLayout;
  accentColor: string;
  columns: number;
  showTimer: boolean;
  showScore: boolean;
  showRecent: boolean;
  completionText: string;
  sortBy: "completed_at" | "score";
};

export type ClassroomInteraction = {
  id: string;
  organizationId: string | null;
  ownerUserId: string;
  name: string;
  description: string;
  sceneId: string;
  sceneName: string;
  targets: Array<{ agentId: string; agentName: string }>;
  displayConfig: ClassroomDisplayConfig;
  publicId: string;
  status: "draft" | "active" | "ended";
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClassroomEvent = {
  id: string;
  interactionId: string;
  agentBindingId: string | null;
  agentName: string;
  taskKey: string;
  summary: string;
  score: number | null;
  occurredAt: string;
};

type SaveClassroomInteractionInput = {
  interactionId?: string;
  name: string;
  description?: string;
  sceneId: string;
  agentIds: string[];
  displayConfig: ClassroomDisplayConfig;
};

function organizationHeaders() {
  const organizationId = getActiveOrganizationId();
  return organizationId ? { "x-organization-id": organizationId } : undefined;
}

function useClassroomInteractionsQuery(options?: {
  enabled?: boolean;
  refetchInterval?: number;
}) {
  const organizationId = getActiveOrganizationId();
  return useQuery<ClassroomInteraction[]>({
    queryKey: ["classroom", organizationId, "interactions"],
    queryFn: () =>
      apiHttpClient.get("/organizations/classroom/interactions", {
        headers: organizationHeaders(),
      }),
    ...options,
  });
}

function useClassroomEventsQuery(interactionId: string | null, options?: { enabled?: boolean }) {
  const organizationId = getActiveOrganizationId();
  return useQuery<ClassroomEvent[]>({
    queryKey: ["classroom", organizationId, "events", interactionId],
    queryFn: () =>
      apiHttpClient.get(`/organizations/classroom/interactions/${interactionId}/events`, {
        params: { limit: 500 },
        headers: organizationHeaders(),
      }),
    enabled: Boolean(interactionId) && options?.enabled !== false,
    refetchInterval: 2000,
  });
}

function useSaveClassroomInteractionMutation(options?: {
  onSuccess?: (interaction: ClassroomInteraction) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation<ClassroomInteraction, Error, SaveClassroomInteractionInput>({
    mutationFn: (data) => {
      const payload = {
        name: data.name,
        description: data.description,
        sceneId: data.sceneId,
        agentIds: data.agentIds,
        displayConfig: data.displayConfig,
      };
      return data.interactionId
        ? apiHttpClient.patch(
            `/organizations/classroom/interactions/${data.interactionId}`,
            payload,
            { headers: organizationHeaders() },
          )
        : apiHttpClient.post("/organizations/classroom/interactions", payload, {
            headers: organizationHeaders(),
          });
    },
    onSuccess: (interaction) => {
      queryClient.invalidateQueries({ queryKey: ["classroom"] });
      options?.onSuccess?.(interaction);
    },
  });
}

function useRemoveClassroomInteractionMutation(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: (interactionId) =>
      apiHttpClient.delete(`/organizations/classroom/interactions/${interactionId}`, {
        headers: organizationHeaders(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom"] });
      options?.onSuccess?.();
    },
  });
}

function useStartClassroomInteractionMutation(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation<{ interaction: ClassroomInteraction }, Error, string>({
    mutationFn: (interactionId) =>
      apiHttpClient.post(
        `/organizations/classroom/interactions/${interactionId}/start`,
        undefined,
        { headers: organizationHeaders() },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom"] });
      options?.onSuccess?.();
    },
  });
}

function useEndClassroomInteractionMutation(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation<ClassroomInteraction, Error, string>({
    mutationFn: (interactionId) =>
      apiHttpClient.post(`/organizations/classroom/interactions/${interactionId}/end`, undefined, {
        headers: organizationHeaders(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom"] });
      options?.onSuccess?.();
    },
  });
}

function useClassroomTestEventMutation(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  return useMutation<ClassroomEvent, Error, { agentId: string; summary: string; score?: number }>({
    mutationFn: (data) =>
      apiHttpClient.post("/organizations/classroom/events/test", data, {
        headers: organizationHeaders(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom"] });
      options?.onSuccess?.();
    },
  });
}

// ---------------------------------------------------------------------------
// 展示辅助
// ---------------------------------------------------------------------------

const LAYOUT_OPTIONS = [
  { value: "grid", label: "完成网格", icon: LayoutGrid },
  { value: "leaderboard", label: "排行榜", icon: Trophy },
  { value: "timeline", label: "时间线", icon: ListOrdered },
] as const;

const LAYOUT_LABELS: Record<ClassroomDisplayLayout, string> = {
  grid: "完成网格",
  leaderboard: "排行榜",
  timeline: "时间线",
};

const ACCENT_OPTIONS = ["#0f6cbd", "#107c10", "#d83b01", "#c239b3", "#5c2d91", "#006666"];

const DEFAULT_DISPLAY_CONFIG: ClassroomDisplayConfig = {
  title: "课堂任务",
  subtitle: "完成任务后将在这里显示",
  layout: "grid",
  accentColor: "#0f6cbd",
  columns: 4,
  showTimer: true,
  showScore: false,
  showRecent: true,
  completionText: "{agent} 已完成",
  sortBy: "completed_at",
};

function displayUrl(interaction: ClassroomInteraction) {
  return `${window.location.origin}/classroom-display/${interaction.publicId}`;
}

function copyDisplayUrl(interaction: ClassroomInteraction) {
  void navigator.clipboard.writeText(displayUrl(interaction));
  toast.success("大屏链接已复制");
}

function elapsedTime(startedAt: string, endedAt?: string | null) {
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "00:00";
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours ? `${pad(hours)}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

// ---------------------------------------------------------------------------
// 活动编辑对话框
// ---------------------------------------------------------------------------

function InteractionEditorDialog({
  open,
  interaction,
  onOpenChange,
}: {
  open: boolean;
  interaction: ClassroomInteraction | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: scenes = [] } = useXiaozhiScenesQuery({ enabled: open });
  const { data: agents = [] } = useXiaozhiAgentsQuery({ enabled: open });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [agentIds, setAgentIds] = useState<Set<string>>(new Set());
  const [display, setDisplay] = useState<ClassroomDisplayConfig>(DEFAULT_DISPLAY_CONFIG);

  useEffect(() => {
    if (!open) return;
    setName(interaction?.name || "");
    setDescription(interaction?.description || "");
    setSceneId(interaction?.sceneId || "");
    setAgentIds(new Set(interaction?.targets.map((target) => target.agentId) || []));
    setDisplay(interaction?.displayConfig || DEFAULT_DISPLAY_CONFIG);
  }, [open, interaction]);

  const save = useSaveClassroomInteractionMutation({
    onSuccess: () => {
      toast.success(interaction ? "课堂活动已更新" : "课堂活动已创建");
      onOpenChange(false);
    },
  });

  function updateDisplay<K extends keyof ClassroomDisplayConfig>(
    key: K,
    value: ClassroomDisplayConfig[K],
  ) {
    setDisplay((current) => ({ ...current, [key]: value }));
  }

  function toggleAgent(agentId: string) {
    setAgentIds((current) => {
      const next = new Set(current);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  }

  const canSave = Boolean(name.trim() && sceneId && agentIds.size);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{interaction ? "编辑课堂活动" : "新建课堂活动"}</DialogTitle>
          <DialogDescription>
            活动开始时会把所选场景统一应用到目标智能体，完成情况实时投到公开大屏。
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">活动名称</span>
              <Input
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如 科学实验观察"
              />
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">开始时应用场景</span>
              <Select value={sceneId} onValueChange={setSceneId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择场景" />
                </SelectTrigger>
                <SelectContent>
                  {scenes.map((scene) => (
                    <SelectItem value={scene.id} key={scene.id}>
                      {scene.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">活动备注（仅后台可见）</span>
            <Textarea
              rows={2}
              value={description}
              maxLength={300}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">目标智能体（{agentIds.size} 个）</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setAgentIds(
                    agentIds.size === agents.length
                      ? new Set()
                      : new Set(agents.map((agent) => agent.id)),
                  )
                }
              >
                {agentIds.size === agents.length ? "清空" : "全选"}
              </Button>
            </div>
            <div className="grid max-h-40 gap-1 overflow-auto border p-2 sm:grid-cols-2">
              {agents.map((agent) => (
                <label className="flex items-center gap-2 py-0.5 text-sm" key={agent.id}>
                  <Checkbox
                    checked={agentIds.has(agent.id)}
                    onCheckedChange={() => toggleAgent(agent.id)}
                  />
                  <span className="truncate">{agent.name}</span>
                </label>
              ))}
              {!agents.length ? (
                <p className="text-muted-foreground py-3 text-center text-xs sm:col-span-2">
                  当前工作空间还没有方糖猫智能体
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 border-t pt-3">
            <p className="text-sm font-medium">展示大屏</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">大屏标题</span>
                <Input
                  value={display.title}
                  maxLength={60}
                  onChange={(event) => updateDisplay("title", event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">副标题</span>
                <Input
                  value={display.subtitle}
                  maxLength={120}
                  onChange={(event) => updateDisplay("subtitle", event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {LAYOUT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={display.layout === option.value ? "default" : "outline"}
                  onClick={() => updateDisplay("layout", option.value)}
                >
                  <option.icon /> {option.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">强调色</span>
                <div className="flex gap-1.5">
                  {ACCENT_OPTIONS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      title={color}
                      aria-label={`选择颜色 ${color}`}
                      className={
                        display.accentColor === color
                          ? "ring-ring size-6 rounded-full ring-2 ring-offset-2"
                          : "size-6 rounded-full"
                      }
                      style={{ backgroundColor: color }}
                      onClick={() => updateDisplay("accentColor", color)}
                    />
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">网格列数（{display.columns} 列）</span>
                <Slider
                  min={2}
                  max={6}
                  step={1}
                  value={[display.columns]}
                  onValueChange={([value]) => updateDisplay("columns", value ?? 4)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="text-muted-foreground text-xs">
                完成文案（用 {"{agent}"} 插入智能体名称）
              </span>
              <Input
                value={display.completionText}
                maxLength={60}
                onChange={(event) => updateDisplay("completionText", event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {(
                [
                  ["showTimer", "显示计时器"],
                  ["showScore", "显示得分"],
                  ["showRecent", "突出最新完成"],
                ] as const
              ).map(([key, label]) => (
                <label className="flex items-center gap-2 text-sm" key={key}>
                  <Switch
                    checked={display[key]}
                    onCheckedChange={(checked) => updateDisplay(key, checked)}
                  />
                  {label}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                排行榜排序
                <Select
                  value={display.sortBy}
                  onValueChange={(value) =>
                    updateDisplay("sortBy", value as ClassroomDisplayConfig["sortBy"])
                  }
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed_at">按完成时间</SelectItem>
                    <SelectItem value="score">按得分</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            loading={save.isPending}
            disabled={!canSave}
            onClick={() =>
              save.mutate({
                interactionId: interaction?.id,
                name: name.trim(),
                description: description.trim(),
                sceneId,
                agentIds: [...agentIds],
                displayConfig: display,
              })
            }
          >
            保存活动
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 进行中活动控制台
// ---------------------------------------------------------------------------

function ActiveInteractionConsole({
  interaction,
  canManage,
}: {
  interaction: ClassroomInteraction;
  canManage: boolean;
}) {
  const [tick, setTick] = useState(0);
  const [testAgentId, setTestAgentId] = useState("");
  const { data: events = [] } = useClassroomEventsQuery(interaction.id);
  const endInteraction = useEndClassroomInteractionMutation({
    onSuccess: () => toast.success("课堂活动已结束"),
  });
  const sendTest = useClassroomTestEventMutation({
    onSuccess: () => toast.success("测试完成通知已发送"),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setTick((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  void tick;

  const completed = useMemo(() => {
    const map = new Map<string, ClassroomEvent>();
    for (const event of [...events].reverse()) {
      if (event.agentBindingId) map.set(event.agentBindingId, event);
    }
    return map;
  }, [events]);

  return (
    <section className="border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <Radio className="size-4" /> 活动进行中
        </span>
        <span className="font-medium">{interaction.name}</span>
        <span className="text-muted-foreground text-xs">
          {interaction.sceneName} · {interaction.targets.length} 个智能体
        </span>
        <span className="ml-auto flex items-center gap-2 text-sm">
          {interaction.startedAt ? (
            <span className="flex items-center gap-1 font-mono">
              <Timer className="size-4" /> {elapsedTime(interaction.startedAt)}
            </span>
          ) : null}
          <strong>
            {completed.size} / {interaction.targets.length}
          </strong>
        </span>
      </div>
      <div className="mt-3 grid max-h-40 grid-cols-2 gap-1.5 overflow-auto sm:grid-cols-3">
        {interaction.targets.map((target) => {
          const event = completed.get(target.agentId);
          return (
            <div
              className={
                event
                  ? "flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-sm"
                  : "flex items-center gap-2 border px-2 py-1.5 text-sm"
              }
              key={target.agentId}
            >
              {event ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <Clock3 className="text-muted-foreground size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{target.agentName}</span>
              {event?.score != null ? <em className="font-mono text-xs">{event.score}</em> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => copyDisplayUrl(interaction)}>
          <Copy /> 复制大屏链接
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(displayUrl(interaction), "_blank", "noopener,noreferrer")}
        >
          <ExternalLink /> 打开大屏
        </Button>
        {canManage ? (
          <>
            <div className="ml-auto flex items-center gap-2">
              <Select value={testAgentId} onValueChange={setTestAgentId}>
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="测试通知：选智能体" />
                </SelectTrigger>
                <SelectContent>
                  {interaction.targets.map((target) => (
                    <SelectItem value={target.agentId} key={target.agentId}>
                      {target.agentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={!testAgentId}
                loading={sendTest.isPending}
                onClick={() =>
                  sendTest.mutate({ agentId: testAgentId, summary: "已完成课堂任务" })
                }
              >
                <Send /> 发送
              </Button>
            </div>
            <Button
              size="sm"
              variant="destructive"
              loading={endInteraction.isPending}
              onClick={() => endInteraction.mutate(interaction.id)}
            >
              <Square /> 结束活动
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 设置面板入口
// ---------------------------------------------------------------------------

export function ClassroomSetting({ canManage }: { canManage?: boolean } = {}) {
  const { data: context } = useWorkspaceContextQuery();
  const activeOrganizationId = getActiveOrganizationId();
  const activeOrganization = context?.organizations.find(
    (item) => item.id === activeOrganizationId,
  );
  // 个人空间拥有全部权限；组织空间按资产管理权限判断。外部传入的 canManage 优先。
  const resolvedCanManage =
    canManage ??
    (activeOrganizationId
      ? Boolean(
          activeOrganization?.permissions.includes(OrganizationPermission.ASSET_MANAGE),
        )
      : true);

  const { data: interactions = [], isLoading } = useClassroomInteractionsQuery({
    enabled: Boolean(context),
    refetchInterval: 3000,
  });
  const { data: scenes = [] } = useXiaozhiScenesQuery({ enabled: Boolean(context) });
  const [editor, setEditor] = useState<{ open: boolean; interaction: ClassroomInteraction | null }>(
    { open: false, interaction: null },
  );

  const startInteraction = useStartClassroomInteractionMutation({
    onSuccess: () => toast.success("场景已应用，课堂活动已开始"),
  });
  const removeInteraction = useRemoveClassroomInteractionMutation({
    onSuccess: () => toast.success("课堂活动已删除"),
  });
  const endInteraction = useEndClassroomInteractionMutation({
    onSuccess: () => toast.success("课堂活动已结束"),
  });

  const activeInteraction = interactions.find((item) => item.status === "active") || null;

  function remove(interaction: ClassroomInteraction) {
    if (
      !window.confirm(`确定删除课堂活动「${interaction.name}」吗？完成记录将一并删除。`)
    ) {
      return;
    }
    removeInteraction.mutate(interaction.id);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">课堂互动</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            开始活动时把场景应用到目标智能体，学生完成任务后实时显示在公开大屏。
          </p>
        </div>
        {resolvedCanManage ? (
          <Button
            size="sm"
            disabled={!scenes.length}
            title={scenes.length ? undefined : "请先在方糖猫场景里创建一个场景"}
            onClick={() => setEditor({ open: true, interaction: null })}
          >
            <Plus /> 新建活动
          </Button>
        ) : null}
      </div>

      {activeInteraction ? (
        <ActiveInteractionConsole interaction={activeInteraction} canManage={resolvedCanManage} />
      ) : null}

      {interactions.length ? (
        <div className="flex flex-col divide-y border-y">
          {interactions.map((interaction) => {
            const running = interaction.status === "active";
            return (
              <div className="flex items-center gap-3 py-2.5" key={interaction.id}>
                <span
                  className={
                    running
                      ? "flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600"
                      : "bg-muted flex size-8 shrink-0 items-center justify-center rounded-md"
                  }
                >
                  {running ? <Radio className="size-4" /> : <UsersRound className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{interaction.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {interaction.sceneName} · {interaction.targets.length} 个智能体 ·{" "}
                    {LAYOUT_LABELS[interaction.displayConfig.layout]}
                  </p>
                </div>
                <Badge variant={running ? "default" : "secondary"}>
                  {running ? "进行中" : interaction.status === "ended" ? "已结束" : "未开始"}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="复制大屏链接"
                    onClick={() => copyDisplayUrl(interaction)}
                  >
                    <Copy />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="打开大屏"
                    onClick={() =>
                      window.open(displayUrl(interaction), "_blank", "noopener,noreferrer")
                    }
                  >
                    <ExternalLink />
                  </Button>
                  {resolvedCanManage ? (
                    <>
                      {!running ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          title="编辑活动"
                          onClick={() => setEditor({ open: true, interaction })}
                        >
                          <Pencil />
                        </Button>
                      ) : null}
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title={running ? "结束活动" : "开始活动"}
                        loading={startInteraction.isPending || endInteraction.isPending}
                        onClick={() =>
                          running
                            ? endInteraction.mutate(interaction.id)
                            : startInteraction.mutate(interaction.id)
                        }
                      >
                        {running ? <Square /> : <Play />}
                      </Button>
                      {!running ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          title="删除活动"
                          loading={removeInteraction.isPending}
                          onClick={() => remove(interaction)}
                        >
                          <Trash2 />
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-y text-center">
          <UsersRound className="text-muted-foreground size-7" />
          <p className="font-medium">还没有课堂活动</p>
          <p className="text-muted-foreground max-w-sm text-xs">
            {scenes.length
              ? "创建活动后即可配置场景、目标智能体和展示大屏。"
              : "课堂活动需要一个开始时统一应用的场景，请先创建场景。"}
          </p>
        </div>
      )}

      <InteractionEditorDialog
        open={editor.open}
        interaction={editor.interaction}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
      />
    </div>
  );
}
