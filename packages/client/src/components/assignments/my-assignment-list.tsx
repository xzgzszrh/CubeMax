import type { AssignmentTargetType, MyAssignment } from "@buildingai/services/web";
import {
  useMyAgentsInfiniteQuery,
  useMyAssignmentsQuery,
  useSubmitAssignmentMutation,
  useWorkflowListQuery,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { ClipboardList, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { formatAssignmentTime, isAssignmentOpen, TARGET_LABELS } from "./utils";

/** 从作业出发提交：先有作业，再从自己的工作流/智能体里挑一个交上去。 */
function SubmitDialog({
  assignment,
  onClose,
}: {
  assignment: MyAssignment | null;
  onClose: () => void;
}) {
  const [targetType, setTargetType] = useState<AssignmentTargetType>("workflow");
  const [targetId, setTargetId] = useState("");
  const [remark, setRemark] = useState("");

  const { data: workflows } = useWorkflowListQuery(
    { page: 1, pageSize: 100 },
    { enabled: Boolean(assignment) },
  );
  const { data: agentPages } = useMyAgentsInfiniteQuery(
    { pageSize: 100 },
    { enabled: Boolean(assignment) },
  );

  const agents = useMemo(() => agentPages?.pages.flatMap((page) => page.items) ?? [], [agentPages]);

  useEffect(() => {
    if (!assignment) return;
    setTargetType(assignment.allowedTypes[0] ?? "workflow");
    setTargetId("");
    setRemark("");
  }, [assignment]);

  const submit = useSubmitAssignmentMutation({
    onSuccess: () => {
      toast.success("已提交给老师");
      onClose();
    },
  });

  const options =
    targetType === "workflow"
      ? (workflows?.items ?? []).map((item) => ({ id: item.id, name: item.name }))
      : agents.map((item) => ({ id: item.id, name: item.name }));

  return (
    <Dialog open={Boolean(assignment)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>提交作业</DialogTitle>
          <DialogDescription>
            {assignment?.title} · 截止 {formatAssignmentTime(assignment?.dueAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>成果类型</Label>
            <Select
              value={targetType}
              onValueChange={(value) => {
                setTargetType(value as AssignmentTargetType);
                setTargetId("");
              }}
            >
              <SelectTrigger className="w-full px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(assignment?.allowedTypes ?? []).map((type) => (
                  <SelectItem value={type} key={type}>
                    {TARGET_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>选择{TARGET_LABELS[targetType]}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="w-full px-3">
                <SelectValue placeholder={`选择要提交的${TARGET_LABELS[targetType]}`} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem value={option.id} key={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!options.length ? (
              <p className="text-muted-foreground text-xs">
                你还没有可提交的{TARGET_LABELS[targetType]}，先去创建一个吧。
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="submission-remark">备注（可选）</Label>
            <Input
              id="submission-remark"
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            loading={submit.isPending}
            disabled={!targetId}
            onClick={() =>
              assignment &&
              submit.mutate({
                assignmentId: assignment.id,
                targetType,
                targetId,
                remark: remark.trim() || undefined,
              })
            }
          >
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 学生的作业列表，`/classroom` 与 `/my-assignments` 共用。 */
export function MyAssignmentList({ emptyHint }: { emptyHint?: string } = {}) {
  const { data: assignments = [], isLoading } = useMyAssignmentsQuery();
  const [submitting, setSubmitting] = useState<MyAssignment | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center border-y">
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center gap-2 border-y text-center">
        <ClipboardList className="text-muted-foreground size-6" />
        <p className="text-sm font-medium">老师还没有布置任务</p>
        {emptyHint ? <p className="text-muted-foreground max-w-sm text-xs">{emptyHint}</p> : null}
      </div>
    );
  }

  return (
    <>
      <div className="divide-y border-y">
        {assignments.map((assignment) => {
          const open = isAssignmentOpen(assignment);
          return (
            <div className="flex items-center gap-3 px-2 py-3" key={assignment.id}>
              <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                <ClipboardList className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{assignment.title}</p>
                  {assignment.mySubmission ? (
                    <Badge
                      variant={
                        assignment.mySubmission.status === "reviewed" ? "default" : "secondary"
                      }
                    >
                      {assignment.mySubmission.status === "reviewed"
                        ? `已批阅${assignment.mySubmission.score != null ? ` · ${assignment.mySubmission.score} 分` : ""}`
                        : "已提交"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">{open ? "待提交" : "已截止"}</Badge>
                  )}
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  截止 {formatAssignmentTime(assignment.dueAt)}
                  {assignment.mySubmission
                    ? ` · 已交：${assignment.mySubmission.targetName}`
                    : assignment.description
                      ? ` · ${assignment.description}`
                      : ""}
                </p>
                {assignment.mySubmission?.feedback ? (
                  <p className="mt-1 text-xs">老师评语：{assignment.mySubmission.feedback}</p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant={assignment.mySubmission ? "ghost" : "default"}
                disabled={!open}
                onClick={() => setSubmitting(assignment)}
              >
                {assignment.mySubmission ? "重新提交" : "提交"}
              </Button>
            </div>
          );
        })}
      </div>
      <SubmitDialog assignment={submitting} onClose={() => setSubmitting(null)} />
    </>
  );
}
