import {
  generateLuaModule,
  type LuaAssistantMessage,
  type LuaModuleDto,
  type LuaModuleItem,
  type LuaModuleSchema,
  testLuaModule,
  useAiProvidersQuery,
  useCreateLuaDeviceRunMutation,
  useCreateLuaModuleMutation,
  useDeleteLuaModuleMutation,
  useLuaDeviceRunLogsQuery,
  useLuaDeviceRunQuery,
  useLuaDevicesQuery,
  useImportProjectLuaModuleMutation,
  useLuaModulesQuery,
  usePublishLuaModuleMutation,
  useProjectSimulatorSessionsQuery,
  useSimulatorSessionsQuery,
  useStopLuaDeviceRunMutation,
  useUnassignedProjectLuaModulesQuery,
  useUnpublishLuaModuleMutation,
  useUpdateLuaModuleMutation,
} from "@buildingai/services/web";
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
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { useIsMobile } from "@buildingai/ui/hooks/use-mobile";
import {
  Bot,
  Braces,
  ChevronLeft,
  ChevronRight,
  Code2,
  Cpu,
  FileCode2,
  FolderInput,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RadioTower,
  Rocket,
  Send,
  Sparkles,
  Square,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useOptionalProgrammingProject } from "../programming/context";
import { createLuaCodeDiff, type LuaCodeDiff, LuaCodeDiffView } from "./lua-code-diff";

const DEFAULT_CODE = `-- params 是主流程传入的参数表
function main(params)
  local name = params.name or "同学"

  return {
    message = "你好，" .. name .. "！",
    length = string.len(name)
  }
end`;

const DEFAULT_INPUT_SCHEMA = `{
  "type": "object",
  "properties": {
    "name": { "type": "string", "title": "名字" }
  }
}`;

const DEFAULT_OUTPUT_SCHEMA = `{
  "type": "object",
  "properties": {
    "message": { "type": "string" },
    "length": { "type": "number" }
  }
}`;

type EditorState = {
  name: string;
  description: string;
  draftCode: string;
  inputSchema: string;
  outputSchema: string;
  testParams: string;
};

type LuaChatMessage = LuaAssistantMessage & {
  codeDiff?: LuaCodeDiff;
};

const LUA_MODULE_MESSAGES_STORAGE_PREFIX = "cubemax:lua-module-messages:";

function toStoredMessages(messages: LuaChatMessage[]): LuaAssistantMessage[] {
  return messages.slice(-100).map(({ role, content, codeDiff }) => ({ role, content, codeDiff }));
}

function isLuaCodeDiff(value: unknown): value is LuaCodeDiff {
  if (!value || typeof value !== "object") return false;
  const diff = value as LuaCodeDiff;
  return (
    typeof diff.additions === "number" &&
    typeof diff.deletions === "number" &&
    Array.isArray(diff.hunks) &&
    diff.hunks.every(
      (hunk) =>
        typeof hunk?.header === "string" &&
        Array.isArray(hunk.lines) &&
        hunk.lines.every(
          (line) =>
            ["context", "addition", "deletion"].includes(line?.type) &&
            typeof line.content === "string",
        ),
    )
  );
}

function normalizeMessages(messages: unknown[]): LuaChatMessage[] {
  return messages.flatMap((message) => {
    if (
      !message ||
      typeof message !== "object" ||
      !["user", "assistant"].includes((message as LuaAssistantMessage).role) ||
      typeof (message as LuaAssistantMessage).content !== "string"
    ) {
      return [];
    }

    const { role, content, codeDiff } = message as LuaAssistantMessage;
    return [{ role, content, codeDiff: isLuaCodeDiff(codeDiff) ? codeDiff : undefined }];
  });
}

function getStoredMessages(moduleId: string): LuaChatMessage[] | undefined {
  try {
    const value = window.sessionStorage.getItem(`${LUA_MODULE_MESSAGES_STORAGE_PREFIX}${moduleId}`);
    if (!value) return undefined;

    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return undefined;

    return normalizeMessages(parsed);
  } catch {
    return undefined;
  }
}

function storeMessages(moduleId: string, messages: LuaChatMessage[]) {
  try {
    window.sessionStorage.setItem(
      `${LUA_MODULE_MESSAGES_STORAGE_PREFIX}${moduleId}`,
      JSON.stringify(toStoredMessages(messages)),
    );
  } catch {
    // Server-side persistence remains the source of truth if storage is unavailable.
  }
}

function removeStoredMessages(moduleId: string) {
  try {
    window.sessionStorage.removeItem(`${LUA_MODULE_MESSAGES_STORAGE_PREFIX}${moduleId}`);
  } catch {
    // Nothing else is required when session storage is unavailable.
  }
}

const emptyEditor = (): EditorState => ({
  name: "我的 Lua 模块",
  description: "",
  draftCode: DEFAULT_CODE,
  inputSchema: DEFAULT_INPUT_SCHEMA,
  outputSchema: DEFAULT_OUTPUT_SCHEMA,
  testParams: '{\n  "name": "小明"\n}',
});

function moduleToEditor(module: LuaModuleItem): EditorState {
  return {
    name: module.name,
    description: module.description ?? "",
    draftCode: module.draftCode,
    inputSchema: JSON.stringify(module.inputSchema, null, 2),
    outputSchema: JSON.stringify(module.outputSchema, null, 2),
    testParams: JSON.stringify(module.testParams ?? {}, null, 2),
  };
}

function parseObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label}必须是 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}

function editorToDto(editor: EditorState, messages: LuaChatMessage[]): LuaModuleDto {
  return {
    name: editor.name.trim(),
    description: editor.description.trim(),
    draftCode: editor.draftCode,
    inputSchema: parseObject(editor.inputSchema, "输入定义") as LuaModuleSchema,
    outputSchema: parseObject(editor.outputSchema, "输出定义") as LuaModuleSchema,
    testParams: parseObject(editor.testParams, "测试参数"),
    assistantMessages: toStoredMessages(messages),
  };
}

function editorToAutoSaveDto(
  editor: EditorState,
  messages: LuaChatMessage[],
): Partial<LuaModuleDto> {
  const dto: Partial<LuaModuleDto> = {
    description: editor.description.trim(),
    draftCode: editor.draftCode,
    assistantMessages: toStoredMessages(messages),
  };
  const name = editor.name.trim();
  if (name) dto.name = name;

  try {
    dto.inputSchema = parseObject(editor.inputSchema, "输入定义") as LuaModuleSchema;
  } catch {
    // Keep saving the other fields while this JSON value is incomplete.
  }
  try {
    dto.outputSchema = parseObject(editor.outputSchema, "输出定义") as LuaModuleSchema;
  } catch {
    // Keep saving the other fields while this JSON value is incomplete.
  }
  try {
    dto.testParams = parseObject(editor.testParams, "测试参数");
  } catch {
    // Keep saving the other fields while this JSON value is incomplete.
  }

  return dto;
}

const DEVICE_RUN_STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  preparing: "准备传输",
  transferring: "传输中",
  running: "运行中",
  stopping: "停止中",
  waiting_for_device: "等待设备",
  succeeded: "已成功",
  failed: "失败",
  stopped: "已停止",
  timed_out: "已超时",
};

const DEVICE_RUN_TERMINAL = new Set(["succeeded", "failed", "stopped", "timed_out"]);

export default function LuaModulesPage({ projectId: projectIdProp }: { projectId?: string } = {}) {
  const project = useOptionalProgrammingProject();
  const projectId = projectIdProp ?? project?.id;
  const isMobile = useIsMobile();
  const modulesQuery = useLuaModulesQuery(projectId ? { projectId } : undefined);
  const simulatorSessionsQuery = useSimulatorSessionsQuery({ enabled: !projectId });
  const projectSimulatorSessionsQuery = useProjectSimulatorSessionsQuery(projectId);
  const simulatorSessions = projectId
    ? (projectSimulatorSessionsQuery.data ?? [])
    : (simulatorSessionsQuery.data ?? []);
  const physicalDevicesQuery = useLuaDevicesQuery();
  const navigate = useNavigate();
  const { confirm } = useAlertDialog();
  const providersQuery = useAiProvidersQuery({ supportedModelTypes: "llm" });
  const modules = modulesQuery.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const [editorModuleId, setEditorModuleId] = useState<string>();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [result, setResult] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [messages, setMessages] = useState<LuaChatMessage[]>([]);
  const [fileSidebarOpen, setFileSidebarOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [simulatorSessionId, setSimulatorSessionId] = useState<string>("none");
  const [physicalDeviceId, setPhysicalDeviceId] = useState<string>("none");
  const [physicalRunId, setPhysicalRunId] = useState<string>();
  const [newModuleDialogOpen, setNewModuleDialogOpen] = useState(false);
  const [importModuleDialogOpen, setImportModuleDialogOpen] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const moduleDraftsRef = useRef(
    new Map<string, { editor: EditorState; messages: LuaChatMessage[] }>(),
  );
  const moduleSaveQueueRef = useRef(new Map<string, Promise<unknown>>());

  useEffect(() => {
    if (isMobile) setFileSidebarOpen(false);
  }, [isMobile]);
  const cacheModuleDraft = useCallback(
    (id: string, nextEditor: EditorState, nextMessages: LuaChatMessage[]) => {
      moduleDraftsRef.current.set(id, { editor: nextEditor, messages: nextMessages });
      storeMessages(id, nextMessages);
    },
    [],
  );

  const physicalRunQuery = useLuaDeviceRunQuery(
    physicalDeviceId === "none" ? undefined : physicalDeviceId,
    physicalRunId,
  );
  const physicalRunLogsQuery = useLuaDeviceRunLogsQuery(
    physicalDeviceId === "none" ? undefined : physicalDeviceId,
    physicalRunId,
  );

  const models = useMemo(
    () =>
      (providersQuery.data ?? []).flatMap((provider) =>
        provider.models.map((model) => ({
          ...model,
          providerName: provider.name,
        })),
      ),
    [providersQuery.data],
  );

  const selected = useMemo(
    () => modules.find((module) => module.id === selectedId),
    [modules, selectedId],
  );

  useEffect(() => {
    if (!selected || editorModuleId === selected.id) return;
    const cached = moduleDraftsRef.current.get(selected.id);
    const nextEditor = cached?.editor ?? moduleToEditor(selected);
    const nextMessages =
      cached?.messages ??
      getStoredMessages(selected.id) ??
      normalizeMessages(selected.assistantMessages ?? []);
    setEditor(nextEditor);
    setMessages(nextMessages);
    cacheModuleDraft(selected.id, nextEditor, nextMessages);
    setResult("");
    setEditorModuleId(selected.id);
  }, [cacheModuleDraft, editorModuleId, selected]);

  useEffect(() => {
    if (modulesQuery.isSuccess && !selectedId && modules[0]) {
      setSelectedId(modules[0].id);
    }
  }, [modules, modulesQuery.isSuccess, selectedId]);

  useEffect(() => {
    if (!modelId && models[0]) setModelId(models[0].id);
  }, [modelId, models]);

  useEffect(() => {
    if (!project) return;
    setSimulatorSessionId(project.simulatorSessionId ?? "none");
    setPhysicalDeviceId(project.deviceId ?? "none");
  }, [project]);

  const selectCreatedModule = useCallback(
    (module: LuaModuleItem) => {
      const nextEditor = moduleToEditor(module);
      const nextMessages = normalizeMessages(module.assistantMessages ?? []);
      setEditor(nextEditor);
      setMessages(nextMessages);
      cacheModuleDraft(module.id, nextEditor, nextMessages);
      setEditorModuleId(module.id);
      setSelectedId(module.id);
    },
    [cacheModuleDraft],
  );

  const createMutation = useCreateLuaModuleMutation(
    {
      onSuccess: (module) => {
        selectCreatedModule(module);
        setNewModuleDialogOpen(false);
        setNewModuleName("");
        toast.success("Lua 模块已创建");
      },
      onError: (error) => toast.error(error.message),
    },
    projectId,
  );
  const unassignedModulesQuery = useUnassignedProjectLuaModulesQuery(projectId, {
    enabled: Boolean(projectId && importModuleDialogOpen),
  });
  const importMutation = useImportProjectLuaModuleMutation({
    onSuccess: (module) => {
      selectCreatedModule(module);
      setImportModuleDialogOpen(false);
      void modulesQuery.refetch();
      toast.success("Lua 模块已导入工程");
    },
    onError: (error) => toast.error(error.message),
  });
  const { mutateAsync: persistModuleAsync } = useUpdateLuaModuleMutation({
    onError: (error) => toast.error(`自动保存失败：${error.message}`),
  });
  const publishMutation = usePublishLuaModuleMutation({
    onSuccess: () => toast.success("模块已发布，可在编程中使用"),
    onError: (error) => toast.error(error.message),
  });
  const unpublishMutation = useUnpublishLuaModuleMutation({
    onSuccess: () => toast.success("模块已取消发布"),
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = useDeleteLuaModuleMutation({
    onSuccess: () => {
      if (selectedId) {
        moduleDraftsRef.current.delete(selectedId);
        moduleSaveQueueRef.current.delete(selectedId);
        removeStoredMessages(selectedId);
      }
      setSelectedId(undefined);
      setEditorModuleId(undefined);
      setEditor(emptyEditor());
      setResult("");
      setMessages([]);
      toast.success("模块已删除");
    },
    onError: (error) => toast.error(error.message),
  });
  const queueModuleSave = useCallback(
    (id: string, dto: Partial<LuaModuleDto>) => {
      const previous = moduleSaveQueueRef.current.get(id) ?? Promise.resolve();
      const next = previous.catch(() => undefined).then(() => persistModuleAsync({ id, dto }));
      moduleSaveQueueRef.current.set(id, next);
      return next;
    },
    [persistModuleAsync],
  );
  const handleDeleteModule = async () => {
    if (!selectedId) return;

    try {
      await confirm({
        title: "删除模块",
        description: `确定要删除模块「${selected?.name ?? "当前模块"}」吗？此操作不可恢复。`,
        confirmText: "删除",
        cancelText: "取消",
        confirmVariant: "destructive",
      });
    } catch {
      return;
    }

    deleteMutation.mutate(selectedId);
  };
  const createDeviceRunMutation = useCreateLuaDeviceRunMutation({
    onSuccess: (run) => {
      setPhysicalRunId(run.id);
      setDetailsOpen(true);
      toast.success("任务已提交到物理设备");
    },
    onError: (error) => toast.error(error.message),
  });
  const stopDeviceRunMutation = useStopLuaDeviceRunMutation({
    onSuccess: () => toast.success("停止请求已发送"),
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => {
    if (!selectedId || editorModuleId !== selectedId) return;
    cacheModuleDraft(selectedId, editor, messages);
    const timer = window.setTimeout(() => {
      void queueModuleSave(selectedId, editorToAutoSaveDto(editor, messages)).catch(
        () => undefined,
      );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [cacheModuleDraft, editor, editorModuleId, messages, queueModuleSave, selectedId]);

  const persistCurrentModule = async () => {
    if (!selectedId || editorModuleId !== selectedId) return;
    cacheModuleDraft(selectedId, editor, messages);
    try {
      await queueModuleSave(selectedId, editorToAutoSaveDto(editor, messages));
    } catch {
      // The mutation reports the error; the local module cache still preserves the draft.
    }
  };

  const selectModule = async (id: string) => {
    if (id === selectedId) {
      if (isMobile) setFileSidebarOpen(false);
      return;
    }
    await persistCurrentModule();
    setEditorModuleId(undefined);
    setSelectedId(id);
    if (isMobile) setFileSidebarOpen(false);
  };

  const createModule = () => {
    const name = newModuleName.trim();
    if (!name) return;
    void persistCurrentModule();
    const initialEditor = { ...emptyEditor(), name };
    createMutation.mutate(editorToDto(initialEditor, []));
  };

  const run = async (targetSimulatorSessionId?: string) => {
    try {
      if (!selectedId) {
        toast.error("请先新建模块");
        return;
      }
      setRunning(true);
      const response = await testLuaModule(
        selectedId,
        parseObject(editor.testParams, "测试参数"),
        editor.draftCode,
        targetSimulatorSessionId,
      );
      setResult(JSON.stringify(response, null, 2));
      setDetailsOpen(true);
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  };

  const runOnPhysicalDevice = () => {
    if (physicalDeviceId === "none") {
      toast.error("请选择物理设备");
      return;
    }
    try {
      const usesDisplay = /\bxiaozhi\s*\.\s*ui\b/.test(editor.draftCode);
      createDeviceRunMutation.mutate({
        deviceId: physicalDeviceId,
        dto: {
          name: editor.name.trim() || "未命名 Lua 模块",
          moduleId: selectedId,
          projectId,
          source: editor.draftCode,
          params: parseObject(editor.testParams, "测试参数"),
          requiredCapabilities: usesDisplay ? ["lua", "xiaozhi", "display"] : ["lua", "xiaozhi"],
          timeoutMs: usesDisplay ? 60_000 : 10_000,
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "测试参数格式错误");
    }
  };

  const runOnProjectTarget = () => {
    if (!project || project.runtimeTarget === "local") {
      void run();
      return;
    }
    if (project.runtimeTarget === "simulator") {
      if (!project.simulatorSessionId) {
        toast.error("工程尚未选择仿真会话");
        return;
      }
      void run(project.simulatorSessionId);
      return;
    }
    runOnPhysicalDevice();
  };

  const publish = async () => {
    if (!selectedId) return;
    try {
      await queueModuleSave(selectedId, editorToDto(editor, messages));
      await publishMutation.mutateAsync(selectedId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布失败");
    }
  };

  const clearMessages = async () => {
    if (!selectedId || messages.length === 0) return;
    setMessages([]);
    cacheModuleDraft(selectedId, editor, []);
    try {
      await queueModuleSave(selectedId, { assistantMessages: [] });
      toast.success("对话已清空");
    } catch {
      // The mutation already reports the persistence error.
    }
  };

  const generate = async () => {
    const userMessage = prompt.trim();
    if (!userMessage || generating) return;
    if (!selectedId) {
      toast.error("请先新建一个模块");
      return;
    }
    if (!modelId) {
      toast.error("请先选择一个可用的 LLM 模型");
      return;
    }

    try {
      const current = {
        name: editor.name,
        description: editor.description,
        draftCode: editor.draftCode,
        inputSchema: parseObject(editor.inputSchema, "输入定义") as LuaModuleSchema,
        outputSchema: parseObject(editor.outputSchema, "输出定义") as LuaModuleSchema,
        testParams: parseObject(editor.testParams, "测试参数"),
      };
      const history = messages.slice(-12).map(({ role, content }) => ({ role, content }));
      const userMessages: LuaChatMessage[] = [
        ...messages,
        { role: "user", content: userMessage },
      ].slice(-100);
      setMessages(userMessages);
      cacheModuleDraft(selectedId, editor, userMessages);
      void queueModuleSave(selectedId, {
        assistantMessages: toStoredMessages(userMessages),
      }).catch(() => undefined);
      setPrompt("");
      setGenerating(true);
      const generated = await generateLuaModule({
        target: "device",
        modelId,
        message: userMessage,
        messages: history,
        current,
      });
      const generatedEditor: EditorState = {
        name: generated.name,
        description: generated.description,
        draftCode: generated.draftCode,
        inputSchema: JSON.stringify(generated.inputSchema, null, 2),
        outputSchema: JSON.stringify(generated.outputSchema, null, 2),
        testParams: JSON.stringify(generated.testParams, null, 2),
      };
      const nextMessages: LuaChatMessage[] = [
        ...userMessages,
        {
          role: "assistant",
          content: generated.reply,
          codeDiff: createLuaCodeDiff(current.draftCode, generated.draftCode),
        },
      ].slice(-100);
      setEditor(generatedEditor);
      setMessages(nextMessages);
      cacheModuleDraft(selectedId, generatedEditor, nextMessages);
      void queueModuleSave(selectedId, editorToDto(generatedEditor, nextMessages)).catch(
        () => undefined,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      const failedMessages: LuaChatMessage[] = [
        ...messages,
        { role: "user", content: userMessage },
        { role: "assistant", content: `生成失败：${message}` },
      ].slice(-100);
      setMessages(failedMessages);
      if (selectedId) {
        cacheModuleDraft(selectedId, editor, failedMessages);
        void queueModuleSave(selectedId, {
          assistantMessages: toStoredMessages(failedMessages),
        }).catch(() => undefined);
      }
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-background flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex min-h-16 flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <div className="mr-auto min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-semibold">{editor.name || "未命名模块"}</h1>
            {selected && (
              <Badge variant="outline">
                {projectId ? "工程模块" : selected.isPublished ? "已发布" : "草稿"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {editor.description || "Lua 模块"}
          </p>
        </div>
        <Button
          variant={detailsOpen ? "secondary" : "outline"}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <Braces /> 代码与配置
          {detailsOpen ? <ChevronRight /> : <ChevronLeft />}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            projectId
              ? runOnProjectTarget()
              : void run(simulatorSessionId === "none" ? undefined : simulatorSessionId)
          }
          disabled={
            running ||
            !selectedId ||
            (project?.runtimeTarget === "device" && createDeviceRunMutation.isPending)
          }
        >
          <Play /> {running ? "运行中" : "运行"}
        </Button>
        {!projectId && (
          <>
            <Select
              value={physicalDeviceId}
              onValueChange={(value) => {
                setPhysicalDeviceId(value);
                setPhysicalRunId(undefined);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="选择物理设备" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">选择物理设备</SelectItem>
                {(physicalDevicesQuery.data ?? []).map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.displayName} · {device.online ? "在线" : "离线"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={runOnPhysicalDevice}
              disabled={
                physicalDeviceId === "none" ||
                !editor.draftCode.trim() ||
                createDeviceRunMutation.isPending
              }
            >
              <RadioTower />
              {createDeviceRunMutation.isPending ? "发送中" : "发送并运行"}
            </Button>
          </>
        )}
        {!projectId && selected?.isPublished && (
          <Button variant="outline" onClick={() => unpublishMutation.mutate(selected.id)}>
            取消发布
          </Button>
        )}
        {!projectId && (
          <Button onClick={publish} disabled={!selectedId || publishMutation.isPending}>
            <Rocket /> {selected?.isPublished ? "重新发布" : "发布"}
          </Button>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {fileSidebarOpen && (
          <button
            type="button"
            aria-label="关闭模块列表"
            className="absolute inset-0 z-10 bg-black/20 md:hidden"
            onClick={() => setFileSidebarOpen(false)}
          />
        )}
        <aside
          className={`bg-background flex shrink-0 flex-col border-r shadow-sm transition-[width,transform] duration-200 max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:w-60 ${
            fileSidebarOpen ? "w-60" : "w-14 max-md:-translate-x-full"
          }`}
        >
          <div
            className={`flex h-14 shrink-0 items-center border-b ${
              fileSidebarOpen ? "justify-between px-3" : "justify-center"
            }`}
          >
            {fileSidebarOpen && <h2 className="text-sm font-medium">Lua 模块</h2>}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setFileSidebarOpen((open) => !open)}
              title={fileSidebarOpen ? "收起模块列表" : "展开模块列表"}
            >
              {fileSidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
          </div>
          <div
            className={fileSidebarOpen ? "grid gap-2 p-3" : "flex flex-col items-center gap-2 py-3"}
          >
            <Button
              className={fileSidebarOpen ? "w-full" : undefined}
              variant="outline"
              size={fileSidebarOpen ? "default" : "icon"}
              title="新建模块"
              disabled={generating}
              onClick={() => {
                setNewModuleName("");
                setNewModuleDialogOpen(true);
              }}
            >
              <Plus />
              {fileSidebarOpen && "新建模块"}
            </Button>
            {projectId && (
              <Button
                className={fileSidebarOpen ? "w-full" : undefined}
                variant="ghost"
                size={fileSidebarOpen ? "default" : "icon"}
                title="导入未归属模块"
                disabled={generating}
                onClick={() => setImportModuleDialogOpen(true)}
              >
                <FolderInput />
                {fileSidebarOpen && "导入模块"}
              </Button>
            )}
          </div>
          <div
            className={`min-h-0 flex-1 space-y-1 overflow-y-auto ${fileSidebarOpen ? "px-3 pb-3" : "px-2 pb-3"}`}
          >
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                title={module.name}
                disabled={generating}
                onClick={() => void selectModule(module.id)}
                className={`relative flex h-10 w-full items-center rounded-md text-left text-sm ${
                  fileSidebarOpen ? "gap-2 px-2.5" : "justify-center"
                } ${selectedId === module.id ? "bg-accent" : "hover:bg-muted"}`}
              >
                <FileCode2 className="size-4 shrink-0" />
                {fileSidebarOpen && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{module.name}</span>
                    {!projectId && module.isPublished && (
                      <span className="size-2 rounded-full bg-emerald-500" />
                    )}
                  </>
                )}
                {!projectId && !fileSidebarOpen && module.isPublished && (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 md:h-14 md:flex-nowrap md:gap-3 md:px-5 md:py-0">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setFileSidebarOpen(true)}
              title="打开模块列表"
            >
              <PanelLeftOpen />
            </Button>
            <Sparkles className="text-primary size-5" />
            <div className="mr-auto min-w-0">
              <h2 className="text-sm font-semibold">AI 模块助手</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void clearMessages()}
              disabled={!selectedId || messages.length === 0 || generating}
              title="清空当前模块的对话记录"
              className="max-md:size-8 max-md:p-0"
            >
              <Trash2 /> <span className="max-md:sr-only">清空对话</span>
            </Button>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="w-56 max-md:order-2 max-md:w-full">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} · {model.providerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-8">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                  <span className="bg-primary/10 text-primary mb-5 flex size-12 items-center justify-center rounded-lg">
                    <Sparkles className="size-6" />
                  </span>
                  <h2 className="text-xl font-semibold">你想做一个什么模块？</h2>
                  <p className="text-muted-foreground mt-2 max-w-md text-sm">
                    用自己的话描述目标，AI 会完成 Lua 代码和输入输出配置。
                  </p>
                  <div className="mt-7 grid w-full max-w-2xl gap-2 sm:grid-cols-3">
                    {[
                      "生成一个成绩等级判断模块",
                      "给输出增加一条友好的提示",
                      "解释当前模块的运行过程",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="hover:bg-muted min-h-20 rounded-md border px-3 py-3 text-left text-sm transition-colors"
                        onClick={() => setPrompt(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                          message.role === "user"
                            ? "bg-foreground text-background"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {message.role === "user" ? (
                          <UserRound className="size-4" />
                        ) : (
                          <Bot className="size-4" />
                        )}
                      </span>
                      {message.role === "user" ? (
                        <div className="bg-foreground text-background max-w-[82%] rounded-md px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
                          {message.content}
                        </div>
                      ) : (
                        <div className="max-w-[calc(100%-2.75rem)] min-w-0 flex-1 space-y-2.5">
                          <div className="bg-muted rounded-md px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
                            {message.content}
                          </div>
                          {message.codeDiff && <LuaCodeDiffView diff={message.codeDiff} />}
                        </div>
                      )}
                    </div>
                  ))}
                  {generating && (
                    <div className="text-muted-foreground flex items-center gap-3 text-sm">
                      <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-md">
                        <Loader2 className="size-4 animate-spin" />
                      </span>
                      正在生成模块
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="shrink-0 px-5 pt-2 pb-5">
            <div className="mx-auto w-full max-w-3xl">
              <div className="focus-within:ring-ring bg-background flex items-end gap-2 rounded-lg border p-2 shadow-sm focus-within:ring-1">
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void generate();
                    }
                  }}
                  placeholder="描述你想让模块完成的任务"
                  disabled={!selectedId}
                  className="min-h-20 resize-none border-0 px-2 py-2 shadow-none focus-visible:ring-0"
                />
                <Button
                  size="icon"
                  onClick={() => void generate()}
                  disabled={!selectedId || !prompt.trim() || generating || !modelId}
                  title="发送"
                >
                  {generating ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </div>
            </div>
          </div>
        </main>

        {detailsOpen && (
          <aside className="bg-background absolute inset-y-0 right-0 z-30 flex w-full max-w-[460px] flex-col border-l shadow-lg">
            <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <Code2 className="size-4" />
              <h2 className="mr-auto text-sm font-semibold">代码与配置</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDetailsOpen(false)}
                title="收起代码与配置"
              >
                <X />
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>模块名称</Label>
                    <Input
                      value={editor.name}
                      onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>说明</Label>
                    <Input
                      value={editor.description}
                      onChange={(event) =>
                        setEditor({ ...editor, description: event.target.value })
                      }
                      placeholder="这个模块用来做什么"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Lua 代码</Label>
                  <Textarea
                    value={editor.draftCode}
                    onChange={(event) => setEditor({ ...editor, draftCode: event.target.value })}
                    spellCheck={false}
                    className="min-h-72 resize-y font-mono text-[13px] leading-5"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>输入定义</Label>
                    <Textarea
                      value={editor.inputSchema}
                      onChange={(event) =>
                        setEditor({ ...editor, inputSchema: event.target.value })
                      }
                      spellCheck={false}
                      className="min-h-44 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>输出定义</Label>
                    <Textarea
                      value={editor.outputSchema}
                      onChange={(event) =>
                        setEditor({ ...editor, outputSchema: event.target.value })
                      }
                      spellCheck={false}
                      className="min-h-44 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label>仿真设备</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs"
                      onClick={() =>
                        navigate(projectId ? `/programming/${projectId}/simulator` : "/simulator")
                      }
                    >
                      <Cpu className="size-3" /> 打开硬件仿真
                    </Button>
                  </div>
                  <Select value={simulatorSessionId} onValueChange={setSimulatorSessionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="不使用仿真设备" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">不使用仿真设备</SelectItem>
                      {simulatorSessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.name} · {session.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    选择后，AI 生成的代码可以通过 device.* 控制虚拟开发板。
                  </p>
                </div>
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <Label>物理设备</Label>
                    {physicalDeviceId !== "none" && (
                      <Badge
                        variant={
                          physicalDevicesQuery.data?.find(
                            (device) => device.deviceId === physicalDeviceId,
                          )?.online
                            ? "default"
                            : "outline"
                        }
                      >
                        {physicalDevicesQuery.data?.find(
                          (device) => device.deviceId === physicalDeviceId,
                        )?.online
                          ? "在线"
                          : "离线"}
                      </Badge>
                    )}
                  </div>
                  {physicalRunQuery.data && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <RadioTower className="size-4" />
                        <span className="font-medium">
                          {DEVICE_RUN_STATUS_LABELS[physicalRunQuery.data.status] ??
                            physicalRunQuery.data.status}
                        </span>
                        <span className="text-muted-foreground ml-auto font-mono text-xs">
                          {physicalRunQuery.data.id.slice(0, 8)}
                        </span>
                        {!DEVICE_RUN_TERMINAL.has(physicalRunQuery.data.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              stopDeviceRunMutation.mutate({
                                deviceId: physicalRunQuery.data.deviceId,
                                runId: physicalRunQuery.data.id,
                              })
                            }
                            disabled={stopDeviceRunMutation.isPending}
                          >
                            <Square /> 停止
                          </Button>
                        )}
                      </div>
                      {(physicalRunQuery.data.result !== undefined ||
                        physicalRunQuery.data.error) && (
                        <pre className="bg-muted max-h-40 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
                          {JSON.stringify(
                            physicalRunQuery.data.error ?? physicalRunQuery.data.result,
                            null,
                            2,
                          )}
                        </pre>
                      )}
                      {(physicalRunLogsQuery.data?.length ?? 0) > 0 && (
                        <pre className="bg-muted max-h-40 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
                          {physicalRunLogsQuery.data
                            ?.map((log) => `${log.sequence} [${log.level}] ${log.text}`)
                            .join("\n")}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>测试参数</Label>
                  <Textarea
                    value={editor.testParams}
                    onChange={(event) => setEditor({ ...editor, testParams: event.target.value })}
                    spellCheck={false}
                    className="min-h-28 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>运行结果</Label>
                  <pre className="bg-muted min-h-28 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
                    {result || "尚未运行"}
                  </pre>
                </div>
                {selectedId && (
                  <Button
                    variant="ghost"
                    className="text-destructive w-full"
                    onClick={handleDeleteModule}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 /> 删除模块
                  </Button>
                )}
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>

      <Dialog open={newModuleDialogOpen} onOpenChange={setNewModuleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createModule();
            }}
          >
            <DialogHeader>
              <DialogTitle>新建 Lua 模块</DialogTitle>
              <DialogDescription>输入模块名称，创建后会立即保存到模块列表。</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="new-lua-module-name">模块名称</Label>
              <Input
                id="new-lua-module-name"
                value={newModuleName}
                onChange={(event) => setNewModuleName(event.target.value)}
                placeholder="例如：成绩等级判断"
                maxLength={100}
                autoFocus
                disabled={createMutation.isPending}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewModuleDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={!newModuleName.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="animate-spin" />}
                创建模块
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={importModuleDialogOpen} onOpenChange={setImportModuleDialogOpen}>
        <DialogContent className="grid-cols-1 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>导入 Lua 模块</DialogTitle>
            <DialogDescription>选择一个尚未归属工程的模块。</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 min-w-0 overflow-y-auto rounded-md border">
            <div className="divide-y">
              {unassignedModulesQuery.isLoading ? (
                <div className="text-muted-foreground p-6 text-center text-sm">正在加载模块</div>
              ) : (unassignedModulesQuery.data?.items.length ?? 0) === 0 ? (
                <div className="text-muted-foreground p-6 text-center text-sm">暂无可导入模块</div>
              ) : (
                unassignedModulesQuery.data?.items.map((module) => (
                  <div key={module.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
                    <FileCode2 className="text-muted-foreground size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{module.name}</div>
                      <div className="text-muted-foreground truncate text-xs">
                        {module.description || "无说明"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={!projectId || importMutation.isPending}
                      onClick={() =>
                        projectId && importMutation.mutate({ projectId, moduleId: module.id })
                      }
                    >
                      <FolderInput /> 导入
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter className="min-w-0">
            <Button variant="outline" onClick={() => setImportModuleDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
