import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import type {
  AssignmentSubmission,
  AssignmentTargetType,
  OrganizationAssignment,
} from "@buildingai/services/web";
import {
  useAssignmentsQuery,
  useAssignmentSubmissionsQuery,
  useOrganizationMembersQuery,
  useRemoveAssignmentMutation,
  useReviewSubmissionMutation,
  useSaveAssignmentMutation,
  useUpdateAssignmentStatusMutation,
} from "@buildingai/services/web";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@buildingai/ui/components/ui/sheet";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { ClipboardList, Eye, LoaderCircle, Pencil, Play, Plus, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { usePodiumWorkspace } from "@/hooks/use-podium-workspace";

import { PodiumPage } from "../_components/podium-page";
import { SubmissionPreview } from "../_components/submission-preview";

export const meta = definePageMeta({
  title: "班级任务列表",
  description: "布置作业并预览学生提交的工作流与智能体",
  icon: "clipboard-list",
});

const STATUS_LABELS = {
  draft: { text: "草稿", variant: "outline" as const },
  published: { text: "进行中", variant: "default" as const },
  closed: { text: "已结束", variant: "secondary" as const },
};

const TARGET_LABELS: Record<AssignmentTargetType, string> = {
  workflow: "工作流",
  agent: "智能体",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "不限";
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "不限" : new Date(parsed).toLocaleString();
}

/** `datetime-local` 需要本地时区的 `YYYY-MM-DDTHH:mm`，不能直接用 ISO 串。 */
function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function AssignmentDialog({
  assignment,
  open,
  onOpenChange,
}: {
  assignment: OrganizationAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [allowedTypes, setAllowedTypes] = useState<AssignmentTargetType[]>(["workflow", "agent"]);
  const [scope, setScope] = useState<"class" | "selected">("class");
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);

  const workspace = usePodiumWorkspace();
  const { data: members = [] } = useOrganizationMembersQuery(workspace.organizationId, "", {
    enabled: open && Boolean(workspace.organizationId),
  });
  const students = useMemo(
    () => members.filter((member) => member.roles.includes("student")),
    [members],
  );

  useEffect(() => {
    if (!open) return;
    setTitle(assignment?.title ?? "");
    setDescription(assignment?.description ?? "");
    setDueAt(toLocalInput(assignment?.dueAt ?? null));
    setAllowedTypes(assignment?.allowedTypes ?? ["workflow", "agent"]);
    const assigned = assignment?.targetUserIds ?? [];
    setTargetUserIds(assigned);
    setScope(assigned.length ? "selected" : "class");
  }, [assignment, open]);

  const save = useSaveAssignmentMutation({
    onSuccess: () => {
      toast.success(assignment ? "作业已更新" : "作业已创建");
      onOpenChange(false);
    },
  });

  function toggleType(type: AssignmentTargetType) {
    setAllowedTypes((previous) =>
      previous.includes(type) ? previous.filter((item) => item !== type) : [...previous, type],
    );
  }

  function toggleStudent(userId: string) {
    setTargetUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter((item) => item !== userId)
        : [...previous, userId],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{assignment ? "编辑作业" : "布置作业"}</DialogTitle>
          <DialogDescription>
            作业发布后，学生可以在自己的课堂页面提交工作流或智能体。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="assignment-title">标题</Label>
            <Input
              id="assignment-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：用工作流做一个古诗接龙"
              maxLength={100}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="assignment-description">作业说明</Label>
            <Textarea
              id="assignment-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="写清楚要求与评分标准"
              rows={4}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="assignment-due">截止时间（可留空）</Label>
            <Input
              id="assignment-due"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>允许提交的成果类型</Label>
            <div className="flex gap-4">
              {(["workflow", "agent"] as AssignmentTargetType[]).map((type) => (
                <label className="flex items-center gap-1.5 text-sm" key={type}>
                  <Checkbox
                    checked={allowedTypes.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                  />
                  {TARGET_LABELS[type]}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>生效范围</Label>
            <Select
              value={scope}
              onValueChange={(value) => {
                const next = value as "class" | "selected";
                setScope(next);
                if (next === "class") setTargetUserIds([]);
              }}
            >
              <SelectTrigger className="w-full px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class">全班（{students.length} 名学生）</SelectItem>
                <SelectItem value="selected">指定学生</SelectItem>
              </SelectContent>
            </Select>
            {scope === "selected" ? (
              students.length ? (
                <div className="max-h-40 space-y-1 overflow-auto border p-2">
                  {students.map((student) => (
                    <label className="flex items-center gap-2 text-sm" key={student.userId}>
                      <Checkbox
                        checked={targetUserIds.includes(student.userId)}
                        onCheckedChange={() => toggleStudent(student.userId)}
                      />
                      <span className="truncate">{student.realName || student.nickname}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {student.username}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  班里还没有学生，先到「人员管理」创建或导入。
                </p>
              )
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            loading={save.isPending}
            disabled={
              title.trim().length < 2 ||
              !allowedTypes.length ||
              (scope === "selected" && !targetUserIds.length)
            }
            onClick={() =>
              save.mutate({
                assignmentId: assignment?.id,
                title: title.trim(),
                description: description.trim(),
                dueAt: dueAt ? new Date(dueAt).toISOString() : null,
                allowedTypes,
                targetUserIds: scope === "selected" ? targetUserIds : [],
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

function SubmissionsSheet({
  assignment,
  onClose,
}: {
  assignment: OrganizationAssignment | null;
  onClose: () => void;
}) {
  const { data: submissions = [], isLoading } = useAssignmentSubmissionsQuery(
    assignment?.id ?? null,
  );
  const [active, setActive] = useState<AssignmentSubmission | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setScore(active?.score != null ? String(active.score) : "");
    setFeedback(active?.feedback ?? "");
  }, [active]);

  const review = useReviewSubmissionMutation({
    onSuccess: () => {
      toast.success("已保存批阅");
      setActive(null);
    },
  });

  return (
    <>
      <Sheet open={Boolean(assignment)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{assignment?.title}</SheetTitle>
            <SheetDescription>共 {submissions.length} 份提交，点击查看成果快照。</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
            {isLoading ? (
              <div className="flex min-h-32 items-center justify-center">
                <LoaderCircle className="size-5 animate-spin" />
              </div>
            ) : submissions.length ? (
              <div className="divide-y border-y">
                {submissions.map((submission) => (
                  <div className="flex items-center gap-3 py-2.5" key={submission.id}>
                    <Avatar className="size-8 rounded-md">
                      <AvatarImage src={submission.author?.avatar} />
                      <AvatarFallback className="rounded-md">
                        {(
                          submission.author?.realName ||
                          submission.author?.nickname ||
                          submission.author?.username ||
                          "?"
                        ).slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">
                          {submission.author?.realName || submission.author?.nickname || "未知学生"}
                        </p>
                        <Badge variant="outline">{TARGET_LABELS[submission.targetType]}</Badge>
                        {submission.status === "reviewed" ? (
                          <Badge variant="secondary">
                            已批阅{submission.score != null ? ` · ${submission.score} 分` : ""}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {submission.targetName} · {formatDateTime(submission.submittedAt)}
                      </p>
                    </div>
                    <Button size="icon-xs" variant="ghost" onClick={() => setActive(submission)}>
                      <Eye />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
                <ClipboardList className="text-muted-foreground size-6" />
                <p className="text-muted-foreground text-sm">还没有学生提交。</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(active)} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {active?.author?.realName || active?.author?.nickname || "学生"}的提交
            </DialogTitle>
            <DialogDescription>
              提交于 {formatDateTime(active?.submittedAt)}
              {active?.remark ? ` · 备注：${active.remark}` : ""}
            </DialogDescription>
          </DialogHeader>
          {active ? <SubmissionPreview snapshot={active.snapshot} /> : null}
          <div className="grid gap-3 border-t pt-4">
            <div className="grid gap-1.5">
              <Label htmlFor="submission-score">评分（0-100，可留空）</Label>
              <Input
                id="submission-score"
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(event) => setScore(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="submission-feedback">评语</Label>
              <Textarea
                id="submission-feedback"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>
              关闭
            </Button>
            <Button
              loading={review.isPending}
              onClick={() =>
                active &&
                review.mutate({
                  submissionId: active.id,
                  score: score.trim() ? Number(score) : null,
                  feedback: feedback.trim(),
                })
              }
            >
              保存批阅
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const PodiumAssignmentsPage = () => {
  useDocumentHead({ title: "班级任务列表" });
  const { data: assignments = [], isLoading } = useAssignmentsQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationAssignment | null>(null);
  const [viewing, setViewing] = useState<OrganizationAssignment | null>(null);

  const remove = useRemoveAssignmentMutation({
    onSuccess: () => toast.success("作业已删除"),
  });
  const updateStatus = useUpdateAssignmentStatusMutation({
    onSuccess: (result: OrganizationAssignment) =>
      toast.success(result.status === "published" ? "作业已发布" : "作业已结束"),
  });

  return (
    <PodiumPage
      title="班级任务列表"
      description="布置作业后学生可以提交工作流或智能体，你可以在这里预览与批阅。"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> 布置作业
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center border-y">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      ) : assignments.length ? (
        <div className="divide-y border-y">
          {assignments.map((assignment) => {
            const status = STATUS_LABELS[assignment.status];
            return (
              <div className="flex items-center gap-3 px-2 py-3" key={assignment.id}>
                <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                  <ClipboardList className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{assignment.title}</p>
                    <Badge variant={status.variant}>{status.text}</Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    截止 {formatDateTime(assignment.dueAt)} ·{" "}
                    {assignment.allowedTypes.map((type) => TARGET_LABELS[type]).join(" / ")} ·{" "}
                    {assignment.targetUserIds?.length
                      ? `指定 ${assignment.targetUserIds.length} 人`
                      : "全班"}{" "}
                    · {assignment.submissionCount ?? 0} 份提交
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="查看提交"
                    onClick={() => setViewing(assignment)}
                  >
                    <Eye />
                  </Button>
                  {assignment.status === "published" ? (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title="结束作业"
                      loading={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({ assignmentId: assignment.id, action: "close" })
                      }
                    >
                      <Square />
                    </Button>
                  ) : (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title="发布作业"
                      loading={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({ assignmentId: assignment.id, action: "publish" })
                      }
                    >
                      <Play />
                    </Button>
                  )}
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="编辑作业"
                    onClick={() => {
                      setEditing(assignment);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="删除作业"
                    loading={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `确定删除作业「${assignment.title}」吗？学生的提交记录也会一并删除。`,
                        )
                      ) {
                        remove.mutate(assignment.id);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-y text-center">
          <ClipboardList className="text-muted-foreground size-7" />
          <p className="font-medium">还没有作业</p>
          <p className="text-muted-foreground max-w-sm text-xs">
            布置一个作业，学生就能把自己做的工作流或智能体交上来。
          </p>
        </div>
      )}

      <AssignmentDialog assignment={editing} open={dialogOpen} onOpenChange={setDialogOpen} />
      <SubmissionsSheet assignment={viewing} onClose={() => setViewing(null)} />
    </PodiumPage>
  );
};

export default PodiumAssignmentsPage;
