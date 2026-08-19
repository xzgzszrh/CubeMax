import {
  type SceneApplyExecution,
  useApplyXiaozhiSceneMutation,
  useExecuteXiaozhiQuickCommandMutation,
  useRemoveXiaozhiQuickCommandMutation,
  useRemoveXiaozhiSceneMutation,
  useSaveXiaozhiQuickCommandMutation,
  useSaveXiaozhiSceneMutation,
  useXiaozhiAgentEditorQuery,
  useXiaozhiQuickCommandsQuery,
  useXiaozhiScenesQuery,
  type XiaozhiAgent,
  type XiaozhiQuickCommand,
  type XiaozhiScene,
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
import { Label } from "@buildingai/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Blocks, Copy, LoaderCircle, Pencil, Pin, Play, Plus, Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AgentConfigFields,
  configToForm,
  type EditorForm,
  formToConfig,
  validateForm,
} from "./agent-config-form";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "—" : new Date(parsed).toLocaleString();
}

function AgentPicker({
  agents,
  selected,
  onChange,
}: {
  agents: XiaozhiAgent[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label>目标智能体（{selected.size} 个）</Label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange(
              selected.size === agents.length
                ? new Set()
                : new Set(agents.map((agent) => agent.id)),
            )
          }
        >
          {selected.size === agents.length ? "清空" : "全选"}
        </Button>
      </div>
      <div className="max-h-44 space-y-1 overflow-auto border p-2">
        {agents.map((agent) => (
          <label className="flex items-center gap-2 text-sm" key={agent.id}>
            <Checkbox
              checked={selected.has(agent.id)}
              onCheckedChange={() => {
                const next = new Set(selected);
                if (next.has(agent.id)) next.delete(agent.id);
                else next.add(agent.id);
                onChange(next);
              }}
            />
            <span className="truncate">{agent.name}</span>
            <span className="text-muted-foreground text-xs">#{agent.upstreamAgentId}</span>
          </label>
        ))}
        {!agents.length ? (
          <p className="text-muted-foreground py-4 text-center text-xs">暂无可选智能体</p>
        ) : null}
      </div>
    </div>
  );
}

function ExecutionSummary({ execution }: { execution: SceneApplyExecution }) {
  return (
    <div className="space-y-2">
      <p className="text-sm">
        场景「{execution.sceneName}」：成功 {execution.succeeded} 个，失败 {execution.failed} 个。
      </p>
      <div className="max-h-48 space-y-1 overflow-auto border p-2">
        {execution.results.map((result) => (
          <div className="flex items-center gap-2 text-sm" key={result.agentId}>
            <span
              className={
                result.success
                  ? "size-2 shrink-0 rounded-full bg-emerald-500"
                  : "size-2 shrink-0 rounded-full bg-red-500"
              }
            />
            <span className="truncate">{result.agentName}</span>
            {result.message ? (
              <span className="text-muted-foreground truncate text-xs">{result.message}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneDialog({
  scene,
  agents,
  open,
  onOpenChange,
}: {
  scene: XiaozhiScene | null;
  agents: XiaozhiAgent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [form, setForm] = useState<EditorForm | null>(null);
  const [resourceAgentId, setResourceAgentId] = useState<string>("");

  // Scene editors borrow one agent's editor resources (voice/model/tool enums)
  // to render the pickers; the saved scene itself is agent-independent.
  const { data: resources, isLoading: resourcesLoading } = useXiaozhiAgentEditorQuery(
    resourceAgentId || null,
    { enabled: open && Boolean(resourceAgentId) },
  );

  useEffect(() => {
    if (!open) return;
    setName(scene?.name || "");
    setDescription(scene?.description || "");
    setForm(null);
    setResourceAgentId(agents[0]?.id || "");
  }, [agents, open, scene]);

  useEffect(() => {
    if (!resources || form) return;
    setForm(configToForm(scene?.config || {}, resources));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources]);

  const saveScene = useSaveXiaozhiSceneMutation({
    onSuccess: () => {
      toast.success(scene ? "场景已更新" : "场景已创建");
      onOpenChange(false);
    },
  });

  function copyFromAgent() {
    if (!resources) return;
    setForm(configToForm(resources.config, resources));
    toast.success(`已复制「${resources.name}」的当前配置`);
  }

  function submit() {
    if (!form || !resources) return;
    if (!name.trim()) {
      toast.error("场景名称不能为空");
      return;
    }
    const formError = validateForm(form);
    if (formError) {
      toast.error(formError);
      return;
    }
    saveScene.mutate({
      sceneId: scene?.id,
      name: name.trim(),
      description: description.trim(),
      config: formToConfig(form, resources),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{scene ? "编辑场景" : "新建场景"}</DialogTitle>
          <DialogDescription>
            场景保存一份完整角色配置，可随时批量应用到多个智能体。
          </DialogDescription>
        </DialogHeader>
        {!agents.length ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            需要至少一个智能体来加载配置选项，请先在“设备管理”中绑定组织的小智账号并同步。
          </p>
        ) : (
          <div className="max-h-[420px] space-y-4 overflow-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5">场景名称</Label>
                <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5">备注</Label>
                <Input
                  value={description}
                  maxLength={300}
                  placeholder="可选"
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-end gap-2 border-t pt-3">
              <div className="flex-1">
                <Label className="mb-1.5">从智能体复制（只复制一次，保存后与来源无关）</Label>
                <Select value={resourceAgentId} onValueChange={setResourceAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择智能体" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem value={agent.id} key={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={!resources || resourcesLoading}
                onClick={copyFromAgent}
              >
                <Copy /> 复制配置
              </Button>
            </div>

            {resourcesLoading || !form || !resources ? (
              <div className="flex min-h-40 items-center justify-center">
                <LoaderCircle className="size-5 animate-spin" />
              </div>
            ) : (
              <AgentConfigFields
                form={form}
                setForm={setForm}
                resources={resources}
                disabled={false}
              />
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button loading={saveScene.isPending} disabled={!form || !resources} onClick={submit}>
            保存场景
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommandDialog({
  command,
  scenes,
  agents,
  open,
  onOpenChange,
}: {
  command: XiaozhiQuickCommand | null;
  scenes: XiaozhiScene[];
  agents: XiaozhiAgent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [pinned, setPinned] = useState(false);
  const [targets, setTargets] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setName(command?.name || "");
    setSceneId(command?.sceneId || scenes[0]?.id || "");
    setPinned(command?.pinned || false);
    setTargets(new Set(command?.targets.map((target) => target.agentId) || []));
  }, [command, open, scenes]);

  const saveCommand = useSaveXiaozhiQuickCommandMutation({
    onSuccess: () => {
      toast.success(command ? "快捷指令已更新" : "快捷指令已创建");
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{command ? "编辑快捷指令" : "新建快捷指令"}</DialogTitle>
          <DialogDescription>选择一个场景和一组目标智能体，之后可一键执行。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5">指令名称</Label>
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5">应用场景</Label>
            <Select value={sceneId} onValueChange={setSceneId}>
              <SelectTrigger>
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
          <AgentPicker agents={agents} selected={targets} onChange={setTargets} />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">固定展示</p>
              <p className="text-muted-foreground text-xs">固定的指令会排在列表顶部。</p>
            </div>
            <Switch checked={pinned} onCheckedChange={setPinned} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            loading={saveCommand.isPending}
            disabled={!name.trim() || !sceneId || !targets.size}
            onClick={() =>
              saveCommand.mutate({
                commandId: command?.id,
                name: name.trim(),
                sceneId,
                pinned,
                agentIds: [...targets],
              })
            }
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 批量执行的结果弹窗，场景与快捷指令共用。 */
function ExecutionDialog({
  execution,
  onClose,
}: {
  execution: SceneApplyExecution | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(execution)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>执行结果</DialogTitle>
          <DialogDescription>批量应用完成，失败的目标可单独重试。</DialogDescription>
        </DialogHeader>
        {execution ? <ExecutionSummary execution={execution} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 场景管理：保存完整角色配置，并一键覆盖到任意智能体。
 */
export function XiaozhiSceneManager({
  canManage,
  agents,
  hideHeading,
}: {
  canManage: boolean;
  agents: XiaozhiAgent[];
  /** 讲台页面已有页头，这里不再重复渲染标题。 */
  hideHeading?: boolean;
}) {
  const { data: scenes = [], isLoading } = useXiaozhiScenesQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScene, setEditingScene] = useState<XiaozhiScene | null>(null);
  const [applyTarget, setApplyTarget] = useState<XiaozhiScene | null>(null);
  const [applyAgentIds, setApplyAgentIds] = useState<Set<string>>(new Set());
  const [execution, setExecution] = useState<SceneApplyExecution | null>(null);

  const removeScene = useRemoveXiaozhiSceneMutation({
    onSuccess: () => toast.success("场景已删除"),
  });
  const applyScene = useApplyXiaozhiSceneMutation({
    onSuccess: (result: SceneApplyExecution) => {
      setApplyTarget(null);
      setExecution(result);
    },
  });

  const createButton = canManage ? (
    <Button
      size="sm"
      onClick={() => {
        setEditingScene(null);
        setDialogOpen(true);
      }}
    >
      <Plus /> 新建场景
    </Button>
  ) : null;

  return (
    <section>
      {hideHeading ? (
        createButton ? (
          <div className="mb-3 flex justify-end">{createButton}</div>
        ) : null
      ) : (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">场景</p>
            <p className="text-muted-foreground text-xs">
              保存完整角色配置，一键覆盖到任意智能体。
            </p>
          </div>
          {createButton}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-24 items-center justify-center border-y">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      ) : scenes.length ? (
        <div className="divide-y border-y">
          {scenes.map((scene) => (
            <div className="flex items-center gap-3 px-2 py-2.5" key={scene.id}>
              <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
                <Blocks className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{scene.name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {scene.description || "无备注"}
                  {scene.sourceAgentName ? ` · 复制自 ${scene.sourceAgentName}` : ""} · 更新于{" "}
                  {formatDateTime(scene.updatedAt)}
                </p>
              </div>
              {canManage ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="应用到智能体"
                    onClick={() => {
                      setApplyTarget(scene);
                      setApplyAgentIds(new Set());
                    }}
                  >
                    <Play />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="编辑场景"
                    onClick={() => {
                      setEditingScene(scene);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="删除场景"
                    loading={removeScene.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `确定删除场景「${scene.name}」吗？引用它的快捷指令也会一并删除。`,
                        )
                      ) {
                        removeScene.mutate(scene.id);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-24 flex-col items-center justify-center gap-1 border-y py-4 text-center">
          <Blocks className="text-muted-foreground size-6" />
          <p className="text-sm font-medium">还没有场景</p>
          <p className="text-muted-foreground text-xs">
            独立设置完整配置，也可以从现有智能体一键复制。
          </p>
        </div>
      )}

      <SceneDialog
        scene={editingScene}
        agents={agents}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <Dialog
        open={Boolean(applyTarget)}
        onOpenChange={(next) => {
          if (!next) setApplyTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>应用场景</DialogTitle>
            <DialogDescription>
              {applyTarget
                ? `「${applyTarget.name}」的配置将覆盖所选智能体，智能体名称保持不变。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <AgentPicker agents={agents} selected={applyAgentIds} onChange={setApplyAgentIds} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyTarget(null)}>
              取消
            </Button>
            <Button
              loading={applyScene.isPending}
              disabled={!applyAgentIds.size}
              onClick={() =>
                applyTarget &&
                applyScene.mutate({ sceneId: applyTarget.id, agentIds: [...applyAgentIds] })
              }
            >
              应用到 {applyAgentIds.size} 个智能体
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExecutionDialog execution={execution} onClose={() => setExecution(null)} />
    </section>
  );
}

/**
 * 快捷指令管理：把一个场景和一组目标智能体绑定，一次执行批量切换。
 */
export function XiaozhiQuickCommandManager({
  canManage,
  agents,
  hideHeading,
}: {
  canManage: boolean;
  agents: XiaozhiAgent[];
  hideHeading?: boolean;
}) {
  const { data: scenes = [] } = useXiaozhiScenesQuery();
  const { data: commands = [], isLoading } = useXiaozhiQuickCommandsQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<XiaozhiQuickCommand | null>(null);
  const [execution, setExecution] = useState<SceneApplyExecution | null>(null);

  const removeCommand = useRemoveXiaozhiQuickCommandMutation({
    onSuccess: () => toast.success("快捷指令已删除"),
  });
  const executeCommand = useExecuteXiaozhiQuickCommandMutation({
    onSuccess: (result: SceneApplyExecution) => setExecution(result),
  });

  const sceneNames = new Map(scenes.map((scene) => [scene.id, scene.name]));

  const createButton = canManage ? (
    <Button
      size="sm"
      variant="outline"
      disabled={!scenes.length}
      onClick={() => {
        setEditingCommand(null);
        setDialogOpen(true);
      }}
    >
      <Plus /> 新建指令
    </Button>
  ) : null;

  return (
    <section>
      {hideHeading ? (
        createButton ? (
          <div className="mb-3 flex justify-end">{createButton}</div>
        ) : null
      ) : (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">快捷指令</p>
            <p className="text-muted-foreground text-xs">
              组合一个场景和一组目标智能体，一次执行批量切换。
            </p>
          </div>
          {createButton}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-24 items-center justify-center border-y">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      ) : commands.length ? (
        <div className="divide-y border-y">
          {commands.map((command) => (
            <div className="flex items-center gap-3 px-2 py-2.5" key={command.id}>
              <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
                <Zap className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{command.name}</p>
                  {command.pinned ? (
                    <Badge variant="secondary">
                      <Pin className="size-3" /> 固定
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  场景：{sceneNames.get(command.sceneId) || "已删除"} · {command.targets.length}{" "}
                  个目标
                </p>
              </div>
              {canManage ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="立即执行"
                    loading={executeCommand.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `确定执行「${command.name}」吗？将把场景应用到 ${command.targets.length} 个智能体。`,
                        )
                      ) {
                        executeCommand.mutate(command.id);
                      }
                    }}
                  >
                    <Play />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="编辑指令"
                    onClick={() => {
                      setEditingCommand(command);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="删除指令"
                    loading={removeCommand.isPending}
                    onClick={() => {
                      if (window.confirm(`确定删除快捷指令「${command.name}」吗？`)) {
                        removeCommand.mutate(command.id);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-24 flex-col items-center justify-center gap-1 border-y py-4 text-center">
          <Zap className="text-muted-foreground size-6" />
          <p className="text-sm font-medium">还没有快捷指令</p>
          <p className="text-muted-foreground text-xs">先创建场景，再把它和目标智能体组合。</p>
        </div>
      )}

      <CommandDialog
        command={editingCommand}
        scenes={scenes}
        agents={agents}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <ExecutionDialog execution={execution} onClose={() => setExecution(null)} />
    </section>
  );
}

/** 设置弹窗里的「自动化」页：场景与快捷指令并列展示。 */
export function XiaozhiAutomationSetting({
  canManage,
  agents,
}: {
  canManage: boolean;
  agents: XiaozhiAgent[];
}) {
  return (
    <div className="space-y-6">
      <XiaozhiSceneManager canManage={canManage} agents={agents} />
      <XiaozhiQuickCommandManager canManage={canManage} agents={agents} />
    </div>
  );
}
