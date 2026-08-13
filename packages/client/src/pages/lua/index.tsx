import {
  generateLuaModule,
  type LuaAssistantMessage,
  type LuaModuleItem,
  type LuaModuleSchema,
  testLuaModule,
  useAiProvidersQuery,
  useCreateLuaModuleMutation,
  useDeleteLuaModuleMutation,
  useLuaModulesQuery,
  usePublishLuaModuleMutation,
  useUnpublishLuaModuleMutation,
  useUpdateLuaModuleMutation,
  useSimulatorSessionsQuery,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
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
import {
  Bot,
  Braces,
  ChevronLeft,
  ChevronRight,
  Code2,
  Cpu,
  FileCode2,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Rocket,
  Save,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const DEFAULT_CODE = `-- params 是工作流传入的参数表
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
    testParams: "{}",
  };
}

function parseObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label}必须是 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}

export default function LuaModulesPage() {
  const modulesQuery = useLuaModulesQuery();
  const simulatorSessionsQuery = useSimulatorSessionsQuery();
  const navigate = useNavigate();
  const providersQuery = useAiProvidersQuery({ supportedModelTypes: "llm" });
  const modules = modulesQuery.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [result, setResult] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [messages, setMessages] = useState<LuaAssistantMessage[]>([]);
  const [fileSidebarOpen, setFileSidebarOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [simulatorSessionId, setSimulatorSessionId] = useState<string>("none");

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
    if (selected) setEditor(moduleToEditor(selected));
  }, [selected]);

  useEffect(() => {
    if (!modelId && models[0]) setModelId(models[0].id);
  }, [modelId, models]);

  const createMutation = useCreateLuaModuleMutation({
    onSuccess: (module) => {
      setSelectedId(module.id);
      toast.success("Lua 模块已创建");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = useUpdateLuaModuleMutation({
    onSuccess: () => toast.success("草稿已保存"),
    onError: (error) => toast.error(error.message),
  });
  const publishMutation = usePublishLuaModuleMutation({
    onSuccess: () => toast.success("模块已发布，可在工作流中使用"),
    onError: (error) => toast.error(error.message),
  });
  const unpublishMutation = useUnpublishLuaModuleMutation({
    onSuccess: () => toast.success("模块已取消发布"),
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = useDeleteLuaModuleMutation({
    onSuccess: () => {
      setSelectedId(undefined);
      setEditor(emptyEditor());
      setResult("");
      setMessages([]);
      toast.success("模块已删除");
    },
    onError: (error) => toast.error(error.message),
  });

  const payload = () => ({
    name: editor.name.trim(),
    description: editor.description.trim(),
    draftCode: editor.draftCode,
    inputSchema: parseObject(editor.inputSchema, "输入定义") as LuaModuleSchema,
    outputSchema: parseObject(editor.outputSchema, "输出定义") as LuaModuleSchema,
  });

  const save = async () => {
    try {
      const dto = payload();
      if (!dto.name) throw new Error("请输入模块名称");
      if (selectedId) updateMutation.mutate({ id: selectedId, dto });
      else createMutation.mutate(dto);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "内容格式错误");
    }
  };

  const run = async () => {
    try {
      if (!selectedId) {
        toast.error("请先保存模块");
        return;
      }
      setRunning(true);
      const response = await testLuaModule(
        selectedId,
        parseObject(editor.testParams, "测试参数"),
        editor.draftCode,
        simulatorSessionId === "none" ? undefined : simulatorSessionId,
      );
      setResult(JSON.stringify(response, null, 2));
      setDetailsOpen(true);
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  };

  const publish = async () => {
    if (!selectedId) return;
    try {
      await updateMutation.mutateAsync({ id: selectedId, dto: payload() });
      await publishMutation.mutateAsync(selectedId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布失败");
    }
  };

  const generate = async () => {
    const userMessage = prompt.trim();
    if (!userMessage || generating) return;
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
      const history = messages.slice(-12);
      setMessages([...messages, { role: "user", content: userMessage }]);
      setPrompt("");
      setGenerating(true);
      const generated = await generateLuaModule({
        modelId,
        message: userMessage,
        messages: history,
        current,
      });
      setEditor({
        name: generated.name,
        description: generated.description,
        draftCode: generated.draftCode,
        inputSchema: JSON.stringify(generated.inputSchema, null, 2),
        outputSchema: JSON.stringify(generated.outputSchema, null, 2),
        testParams: JSON.stringify(generated.testParams, null, 2),
      });
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: generated.reply },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败";
      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", content: `生成失败：${message}` },
      ]);
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
              <Badge variant="outline">{selected.isPublished ? "已发布" : "草稿"}</Badge>
            )}
          </div>
          <p className="text-muted-foreground truncate text-xs">
            {editor.description || "Lua 创作"}
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
          onClick={save}
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          <Save /> 保存
        </Button>
        <Button variant="outline" onClick={run} disabled={running || !selectedId}>
          <Play /> {running ? "运行中" : "运行"}
        </Button>
        {selected?.isPublished && (
          <Button variant="outline" onClick={() => unpublishMutation.mutate(selected.id)}>
            取消发布
          </Button>
        )}
        <Button onClick={publish} disabled={!selectedId || publishMutation.isPending}>
          <Rocket /> {selected?.isPublished ? "重新发布" : "发布"}
        </Button>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`bg-background flex shrink-0 flex-col border-r shadow-sm transition-[width] duration-200 max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 ${
            fileSidebarOpen ? "w-60" : "w-14"
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
          <div className={fileSidebarOpen ? "p-3" : "flex justify-center py-3"}>
            <Button
              className={fileSidebarOpen ? "w-full" : undefined}
              variant="outline"
              size={fileSidebarOpen ? "default" : "icon"}
              title="新建模块"
              onClick={() => {
                setSelectedId(undefined);
                setEditor(emptyEditor());
                setResult("");
                setMessages([]);
              }}
            >
              <Plus />
              {fileSidebarOpen && "新建模块"}
            </Button>
          </div>
          <div
            className={`min-h-0 flex-1 space-y-1 overflow-y-auto ${fileSidebarOpen ? "px-3 pb-3" : "px-2 pb-3"}`}
          >
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                title={module.name}
                onClick={() => {
                  if (module.id !== selectedId) {
                    setMessages([]);
                    setResult("");
                  }
                  setSelectedId(module.id);
                }}
                className={`relative flex h-10 w-full items-center rounded-md text-left text-sm ${
                  fileSidebarOpen ? "gap-2 px-2.5" : "justify-center"
                } ${selectedId === module.id ? "bg-accent" : "hover:bg-muted"}`}
              >
                <FileCode2 className="size-4 shrink-0" />
                {fileSidebarOpen && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{module.name}</span>
                    {module.isPublished && <span className="size-2 rounded-full bg-emerald-500" />}
                  </>
                )}
                {!fileSidebarOpen && module.isPublished && (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 shrink-0 items-center gap-3 border-b px-5">
            <Sparkles className="text-primary size-5" />
            <div className="mr-auto min-w-0">
              <h2 className="text-sm font-semibold">AI 模块助手</h2>
            </div>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="w-56">
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
                      <div
                        className={`max-w-[82%] rounded-md px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                          message.role === "user" ? "bg-foreground text-background" : "bg-muted"
                        }`}
                      >
                        {message.content}
                      </div>
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
                  className="min-h-20 resize-none border-0 px-2 py-2 shadow-none focus-visible:ring-0"
                />
                <Button
                  size="icon"
                  onClick={() => void generate()}
                  disabled={!prompt.trim() || generating || !modelId}
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
                      onClick={() => navigate("/simulator")}
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
                      {(simulatorSessionsQuery.data ?? []).map((session) => (
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
                    onClick={() => deleteMutation.mutate(selectedId)}
                  >
                    <Trash2 /> 删除模块
                  </Button>
                )}
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>
    </div>
  );
}
