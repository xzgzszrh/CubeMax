import {
  testLuaModule,
  useCreateLuaModuleMutation,
  useDeleteLuaModuleMutation,
  useLuaModulesQuery,
  usePublishLuaModuleMutation,
  useUnpublishLuaModuleMutation,
  useUpdateLuaModuleMutation,
  type LuaModuleItem,
  type LuaModuleSchema,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { Code2, Play, Plus, Rocket, Save, Trash2, Undo2 } from "lucide-react";
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
  const navigate = useNavigate();
  const modulesQuery = useLuaModulesQuery();
  const modules = modulesQuery.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [result, setResult] = useState<string>("");
  const [running, setRunning] = useState(false);

  const selected = useMemo(
    () => modules.find((module) => module.id === selectedId),
    [modules, selectedId],
  );

  useEffect(() => {
    if (selected) setEditor(moduleToEditor(selected));
  }, [selected]);

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
      );
      setResult(JSON.stringify(response, null, 2));
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

  return (
    <div className="bg-background flex min-h-[calc(100vh-64px)] flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/workflows")}
          title="返回工作流"
        >
          <Undo2 />
        </Button>
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-base font-semibold">Lua 创作</h1>
          <p className="text-muted-foreground text-xs">编写模块，发布后在工作流中组合使用</p>
        </div>
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

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="border-b p-3 lg:border-r lg:border-b-0">
          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              setSelectedId(undefined);
              setEditor(emptyEditor());
              setResult("");
            }}
          >
            <Plus /> 新建模块
          </Button>
          <div className="mt-3 flex max-h-52 flex-col gap-1 overflow-auto lg:max-h-[calc(100vh-150px)]">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => setSelectedId(module.id)}
                className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${selectedId === module.id ? "bg-accent" : "hover:bg-muted"}`}
              >
                <Code2 className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{module.name}</span>
                {module.isPublished && <span className="size-2 rounded-full bg-emerald-500" />}
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>模块名称</Label>
              <Input
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>说明</Label>
              <Input
                value={editor.description}
                onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                placeholder="这个模块用来做什么"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Lua 代码</Label>
              {selected && (
                <Badge variant="outline">{selected.isPublished ? "已发布" : "草稿"}</Badge>
              )}
            </div>
            <Textarea
              value={editor.draftCode}
              onChange={(e) => setEditor({ ...editor, draftCode: e.target.value })}
              spellCheck={false}
              className="min-h-[430px] resize-y font-mono text-[13px] leading-5"
            />
          </div>
        </main>

        <aside className="space-y-4 border-t p-4 lg:border-t-0 lg:border-l">
          <div className="space-y-1.5">
            <Label>输入定义</Label>
            <Textarea
              value={editor.inputSchema}
              onChange={(e) => setEditor({ ...editor, inputSchema: e.target.value })}
              spellCheck={false}
              className="min-h-36 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>输出定义</Label>
            <Textarea
              value={editor.outputSchema}
              onChange={(e) => setEditor({ ...editor, outputSchema: e.target.value })}
              spellCheck={false}
              className="min-h-36 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label>测试参数</Label>
            <Textarea
              value={editor.testParams}
              onChange={(e) => setEditor({ ...editor, testParams: e.target.value })}
              spellCheck={false}
              className="min-h-24 font-mono text-xs"
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
        </aside>
      </div>
    </div>
  );
}
