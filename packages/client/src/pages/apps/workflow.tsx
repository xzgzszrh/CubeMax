import {
  cancelPublishedWorkflowTask,
  getPublishedWorkflowTaskReport,
  runPublishedWorkflow,
  usePublishedWorkflowQuery,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { ArrowLeft, CircleAlert, Play, Square, Workflow } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

interface WorkflowInputField {
  name: string;
  title: string;
  description?: string;
  type: string;
  required: boolean;
  defaultValue: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getDefaultValue(type: string, value: unknown): unknown {
  if (value !== undefined) return value;
  if (type === "boolean") return false;
  if (type === "number" || type === "integer") return 0;
  if (type === "array") return [];
  if (type === "object" || type === "map") return {};
  return "";
}

function getWorkflowInputFields(schema: Record<string, unknown>): WorkflowInputField[] {
  if (!Array.isArray(schema.nodes)) return [];
  const startNode = schema.nodes.find((node) => isRecord(node) && node.type === "start");
  if (!isRecord(startNode) || !isRecord(startNode.data)) return [];
  const outputs = startNode.data.outputs;
  if (!isRecord(outputs) || !isRecord(outputs.properties)) return [];
  const required = Array.isArray(outputs.required)
    ? outputs.required.filter((item): item is string => typeof item === "string")
    : [];

  return Object.entries(outputs.properties).flatMap(([name, property]) => {
    if (!isRecord(property)) return [];
    const type = typeof property.type === "string" ? property.type : "string";
    return [
      {
        name,
        title: typeof property.title === "string" ? property.title : name,
        description: typeof property.description === "string" ? property.description : undefined,
        type,
        required: required.includes(name),
        defaultValue: getDefaultValue(type, property.default),
      },
    ];
  });
}

export default function WorkflowApplicationPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const workflowQuery = usePublishedWorkflowQuery(workflowId, { retry: false });
  const fields = useMemo(
    () => (workflowQuery.data ? getWorkflowInputFields(workflowQuery.data.schema) : []),
    [workflowQuery.data],
  );
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [taskID, setTaskID] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [outputs, setOutputs] = useState<Record<string, unknown> | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const taskIDRef = useRef<string | null>(null);

  useEffect(() => {
    const nextValues = Object.fromEntries(fields.map((field) => [field.name, field.defaultValue]));
    const nextJsonDrafts = Object.fromEntries(
      fields
        .filter((field) => ["object", "array", "map"].includes(field.type))
        .map((field) => [field.name, JSON.stringify(field.defaultValue, null, 2)]),
    );
    setValues(nextValues);
    setJsonDrafts(nextJsonDrafts);
  }, [fields]);

  useEffect(() => {
    taskIDRef.current = taskID;
  }, [taskID]);

  useEffect(
    () => () => {
      if (taskIDRef.current) {
        void cancelPublishedWorkflowTask(taskIDRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!taskID) return;
    let disposed = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const report = await getPublishedWorkflowTaskReport(taskID);
        if (disposed) return;
        if (!report?.workflowStatus.terminated) {
          timer = window.setTimeout(poll, 500);
          return;
        }

        setTaskID(null);
        if (report.workflowStatus.status === "succeeded") {
          setOutputs(report.outputs ?? {});
          setRunError(null);
          return;
        }

        const message = report.messages?.error
          ?.map((item) => (item.nodeID ? `${item.nodeID}: ${item.message}` : item.message))
          .join("\n");
        setRunError(message || "工作流运行失败");
      } catch (error) {
        if (disposed) return;
        setTaskID(null);
        setRunError(error instanceof Error ? error.message : "工作流运行失败");
      }
    };

    void poll();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [taskID]);

  const setFieldValue = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleRun = async () => {
    if (!workflowId || taskID || starting) return;

    const nextValues = { ...values };
    for (const field of fields) {
      if (["object", "array", "map"].includes(field.type)) {
        try {
          nextValues[field.name] = JSON.parse(jsonDrafts[field.name] || "null");
        } catch {
          toast.error(`${field.title}不是有效的 JSON`);
          return;
        }
      }

      const value = nextValues[field.name];
      if (
        field.required &&
        (value === undefined ||
          value === null ||
          (typeof value === "number" && Number.isNaN(value)) ||
          (typeof value === "string" && !value.trim()))
      ) {
        toast.error(`${field.title}为必填项`);
        return;
      }
    }

    setStarting(true);
    setOutputs(null);
    setRunError(null);
    try {
      const task = await runPublishedWorkflow(workflowId, nextValues);
      setTaskID(task.taskID);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "工作流运行失败");
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!taskID) return;
    try {
      await cancelPublishedWorkflowTask(taskID);
    } finally {
      setTaskID(null);
      setRunError("运行已取消");
    }
  };

  if (workflowQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 py-8 md:px-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (workflowQuery.isError || !workflowQuery.data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <CircleAlert className="text-muted-foreground size-9" />
        <div>
          <h1 className="text-lg font-semibold">工作流应用不可用</h1>
          <p className="text-muted-foreground mt-1 text-sm">该工作流不存在或当前未发布。</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/apps">返回应用</Link>
        </Button>
      </div>
    );
  }

  const workflow = workflowQuery.data;
  const isRunning = starting || !!taskID;

  return (
    <ScrollArea className="h-dvh" viewportClassName="[&_>div]:block!">
      <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-6 md:px-6">
        <header className="border-border flex items-center gap-3 border-b pb-5">
          <Button size="icon" variant="ghost" asChild>
            <Link to="/apps" aria-label="返回应用">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
            <Workflow className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold">{workflow.name}</h1>
              <Badge variant="secondary">已发布</Badge>
            </div>
            {workflow.description && (
              <p className="text-muted-foreground mt-1 truncate text-sm">{workflow.description}</p>
            )}
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <section className="border-border h-fit rounded-lg border p-5" aria-label="工作流输入">
            <h2 className="text-sm font-semibold">输入</h2>
            <div className="mt-5 space-y-5">
              {fields.length === 0 ? (
                <p className="text-muted-foreground text-sm">无需输入参数</p>
              ) : (
                fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={`workflow-input-${field.name}`}>
                      {field.title}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                    {field.type === "boolean" ? (
                      <div className="flex h-9 items-center">
                        <Switch
                          id={`workflow-input-${field.name}`}
                          checked={Boolean(values[field.name])}
                          onCheckedChange={(checked) => setFieldValue(field.name, checked)}
                          disabled={isRunning}
                        />
                      </div>
                    ) : ["object", "array", "map"].includes(field.type) ? (
                      <Textarea
                        id={`workflow-input-${field.name}`}
                        value={jsonDrafts[field.name] ?? ""}
                        onChange={(event) =>
                          setJsonDrafts((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                        className="min-h-28 resize-y font-mono text-xs"
                        disabled={isRunning}
                      />
                    ) : (
                      <Input
                        id={`workflow-input-${field.name}`}
                        type={["number", "integer"].includes(field.type) ? "number" : "text"}
                        step={field.type === "integer" ? 1 : "any"}
                        value={String(values[field.name] ?? "")}
                        onChange={(event) =>
                          setFieldValue(
                            field.name,
                            ["number", "integer"].includes(field.type)
                              ? event.target.value === ""
                                ? undefined
                                : event.target.valueAsNumber
                              : event.target.value,
                          )
                        }
                        disabled={isRunning}
                      />
                    )}
                    {field.description && (
                      <p className="text-muted-foreground text-xs">{field.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
            <Button
              className="mt-6 w-full"
              onClick={taskID ? () => void handleCancel() : () => void handleRun()}
              loading={starting}
              variant={taskID ? "outline" : "default"}
            >
              {taskID ? <Square /> : <Play />}
              {taskID ? "停止" : "运行"}
            </Button>
          </section>

          <section className="border-border min-h-80 rounded-lg border p-5" aria-label="运行结果">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">运行结果</h2>
              {taskID && <Badge variant="outline">运行中</Badge>}
            </div>
            <div className="mt-5">
              {taskID ? (
                <div className="text-muted-foreground flex min-h-56 items-center justify-center text-sm">
                  正在运行...
                </div>
              ) : runError ? (
                <pre className="text-destructive overflow-auto text-sm whitespace-pre-wrap">
                  {runError}
                </pre>
              ) : outputs ? (
                <pre className="bg-muted/50 overflow-auto rounded-md p-4 text-xs leading-6">
                  {JSON.stringify(outputs, null, 2)}
                </pre>
              ) : (
                <div className="text-muted-foreground flex min-h-56 items-center justify-center text-sm">
                  暂无运行结果
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </ScrollArea>
  );
}
