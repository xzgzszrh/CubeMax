import type { AssignmentTargetType, MyAssignment } from "@buildingai/services/web";
import { useMyAssignmentsQuery, useSubmitAssignmentMutation } from "@buildingai/services/web";
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
import { ClipboardList, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { formatAssignmentTime, isAssignmentOpen, TARGET_LABELS } from "./utils";

/**
 * 在「已有成果」的位置直接提交：先选一份还能交的作业，再确认。
 *
 * 与 `MyAssignmentList` 里的提交弹窗相反 —— 那边是先有作业再选成果，
 * 这边是先有成果（当前工作流/智能体）再选作业。
 */
export function SubmitAssignmentDialog({
  targetType,
  targetId,
  targetName,
  open,
  onOpenChange,
}: {
  targetType: AssignmentTargetType;
  targetId: string;
  targetName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: assignments = [], isLoading } = useMyAssignmentsQuery({ enabled: open });
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [remark, setRemark] = useState("");

  const options = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          isAssignmentOpen(assignment) && assignment.allowedTypes.includes(targetType),
      ),
    [assignments, targetType],
  );

  useEffect(() => {
    if (!open) return;
    setAssignmentId(null);
    setRemark("");
  }, [open]);

  const submit = useSubmitAssignmentMutation({
    onSuccess: () => {
      toast.success("已提交给老师");
      onOpenChange(false);
    },
  });

  function renderOption(assignment: MyAssignment) {
    const active = assignmentId === assignment.id;
    return (
      <button
        type="button"
        key={assignment.id}
        className={`hover:bg-muted flex w-full flex-col items-start gap-1 border-b px-3 py-2.5 text-left last:border-b-0 ${
          active ? "bg-muted" : ""
        }`}
        onClick={() => setAssignmentId(assignment.id)}
      >
        <div className="flex w-full items-center gap-2">
          <span className="truncate font-medium">{assignment.title}</span>
          {assignment.mySubmission ? <Badge variant="secondary">已交过</Badge> : null}
        </div>
        <span className="text-muted-foreground text-xs">
          截止 {formatAssignmentTime(assignment.dueAt)}
          {assignment.mySubmission ? ` · 上次提交：${assignment.mySubmission.targetName}` : ""}
        </span>
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>提交到课堂任务</DialogTitle>
          <DialogDescription>
            将当前{TARGET_LABELS[targetType]}
            {targetName ? `「${targetName}」` : ""}提交给老师。重复提交会覆盖上一次。
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <LoaderCircle className="size-5 animate-spin" />
          </div>
        ) : options.length ? (
          <>
            <div className="max-h-64 overflow-auto border-y">{options.map(renderOption)}</div>
            <div className="grid gap-1.5">
              <Label htmlFor="quick-submit-remark">备注（可选）</Label>
              <Input
                id="quick-submit-remark"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                maxLength={500}
              />
            </div>
          </>
        ) : (
          <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
            <ClipboardList className="text-muted-foreground size-6" />
            <p className="text-sm font-medium">没有可提交的任务</p>
            <p className="text-muted-foreground max-w-xs text-xs">
              需要老师发布一份接受{TARGET_LABELS[targetType]}、且指派给你的任务。
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            loading={submit.isPending}
            disabled={!assignmentId}
            onClick={() =>
              assignmentId &&
              submit.mutate({
                assignmentId,
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
