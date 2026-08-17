import {
  cancelPublishedWorkflowTask,
  getPublishedWorkflowTaskReport,
  type ProgrammingTriggerItem,
  type PublishedWorkflowTaskReport,
  useExecuteProgrammingTriggerMutation,
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
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createSchemaDefaults } from "./schema";
import { SchemaForm } from "./schema-form";

type TriggerRunDialogProps = {
  open: boolean;
  trigger?: ProgrammingTriggerItem | null;
  onOpenChange: (open: boolean) => void;
};

function formatTaskStatus(report: PublishedWorkflowTaskReport | null): string {
  if (!report) return "准备运行";
  if (report.workflowStatus.status === "succeeded") return "运行完成";
  if (report.workflowStatus.status === "failed") return "运行失败";
  if (report.workflowStatus.status === "canceled") return "已停止";
  return "运行中";
}

export function TriggerRunDialog({ open, trigger, onOpenChange }: TriggerRunDialogProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [jsonFields, setJsonFields] = useState<Record<string, boolean>>({});
  const [taskId, setTaskId] = useState<string>();
  const [report, setReport] = useState<PublishedWorkflowTaskReport | null>(null);
  const [runError, setRunError] = useState<string>();
  const schema = trigger?.inputSchema ?? { type: "object", properties: {} };
  const required = useMemo(() => new Set(schema.required ?? []), [schema]);
  const isRunning = Boolean(taskId && !report?.workflowStatus.terminated);
  const executeMutation = useExecuteProgrammingTriggerMutation();

  useEffect(() => {
    if (!open) return;
    setValues(createSchemaDefaults(schema));
    setErrors({});
    setJsonFields({});
    setTaskId(undefined);
    setReport(null);
    setRunError(undefined);
  }, [open, trigger?.id]);

  useEffect(() => {
    if (!taskId || report?.workflowStatus.terminated) return;
    let disposed = false;
    const poll = async () => {
      try {
        const next = await getPublishedWorkflowTaskReport(taskId);
        if (!disposed && next) setReport(next);
      } catch (error) {
        if (!disposed) setRunError(error instanceof Error ? error.message : "运行状态读取失败");
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 700);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [taskId, report?.workflowStatus.terminated]);

  useEffect(() => {
    if (!report?.workflowStatus.terminated) return;
    if (report.workflowStatus.status === "succeeded") toast.success("触发器运行完成");
    if (report.workflowStatus.status === "failed") toast.error("触发器运行失败");
  }, [report?.workflowStatus.status, report?.workflowStatus.terminated]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    for (const [name, field] of Object.entries(schema.properties ?? {})) {
      const value = values[name];
      if (required.has(name) && (value === undefined || value === null || value === "")) {
        nextErrors[name] = "此项为必填项";
      }
      if (
        field.type === "integer" &&
        value !== undefined &&
        value !== null &&
        !Number.isInteger(value)
      ) {
        nextErrors[name] = "请输入整数";
      }
      if (
        field.type === "number" &&
        value !== undefined &&
        value !== null &&
        typeof value !== "number"
      ) {
        nextErrors[name] = "请输入数字";
      }
      if ((field.type === "object" || field.type === "array") && jsonFields[name] === false) {
        nextErrors[name] = "请输入有效的 JSON";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRun = async () => {
    if (!trigger || isRunning || !validate()) return;
    setRunError(undefined);
    setReport(null);
    try {
      const result = await executeMutation.mutateAsync({ id: trigger.id, inputs: values });
      setTaskId(result.taskID);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "触发器执行失败");
    }
  };

  const handleCancel = async () => {
    if (!taskId) return;
    try {
      await cancelPublishedWorkflowTask(taskId);
      setReport((current) =>
        current
          ? {
              ...current,
              workflowStatus: { ...current.workflowStatus, status: "canceled", terminated: true },
            }
          : current,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "停止任务失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle>{trigger?.name || "运行触发器"}</DialogTitle>
            {trigger?.isEnabled ? (
              <Badge variant="secondary">表单触发</Badge>
            ) : (
              <Badge variant="outline">已停用</Badge>
            )}
          </div>
          <DialogDescription>
            {trigger?.description?.trim() ||
              `运行工程「${trigger?.project.name || "未选择"}」的主流程`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 pr-4">
          {report?.workflowStatus.terminated ? (
            <div className="space-y-4 py-1">
              <div className="bg-muted/30 flex items-center justify-between rounded-md border px-3 py-3">
                <div>
                  <p className="text-sm font-medium">{formatTaskStatus(report)}</p>
                  <p className="text-muted-foreground mt-1 text-xs">任务编号：{report.id}</p>
                </div>
                <Badge
                  variant={
                    report.workflowStatus.status === "succeeded" ? "secondary" : "destructive"
                  }
                >
                  {report.workflowStatus.status === "succeeded" ? "成功" : "结束"}
                </Badge>
              </div>
              {report.workflowStatus.status === "succeeded" ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">输出结果</p>
                  <pre className="bg-muted/30 max-h-72 overflow-auto rounded-md border p-3 text-xs leading-5">
                    {JSON.stringify(report.outputs ?? {}, null, 2)}
                  </pre>
                </div>
              ) : null}
              {report.messages?.error?.length ? (
                <div className="text-destructive space-y-1 text-sm">
                  {report.messages.error.map((item, index) => (
                    <p key={`${item.message}-${index}`}>{item.message}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : isRunning ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
              <div>
                <p className="text-sm font-medium">主流程运行中</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  可以停止任务，或关闭窗口后稍后查看结果。
                </p>
              </div>
            </div>
          ) : (
            <div className="py-1">
              <SchemaForm
                schema={schema}
                values={values}
                onChange={setValues}
                errors={errors}
                disabled={!trigger?.isEnabled || executeMutation.isPending}
                onJsonValidityChange={(name, valid) =>
                  setJsonFields((current) => ({ ...current, [name]: valid }))
                }
              />
              {runError ? <p className="text-destructive mt-4 text-sm">{runError}</p> : null}
              {!trigger?.project.isPublished ? (
                <p className="text-muted-foreground mt-4 border-t pt-4 text-xs">
                  绑定工程尚未发布，保存发布后才能执行。
                </p>
              ) : null}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4 border-t pt-4">
          {isRunning ? (
            <Button type="button" variant="destructive" onClick={() => void handleCancel()}>
              停止任务
            </Button>
          ) : report?.workflowStatus.terminated ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReport(null);
                setTaskId(undefined);
              }}
            >
              再运行一次
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {!report?.workflowStatus.terminated && !isRunning ? (
            <Button
              type="button"
              disabled={
                !trigger?.isEnabled || executeMutation.isPending || !trigger?.project.isPublished
              }
              onClick={() => void handleRun()}
            >
              {executeMutation.isPending ? "提交中..." : "执行工程"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
