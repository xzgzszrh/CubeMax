import type { AssignmentTargetType } from "@buildingai/services/web";
import { getActiveOrganizationId, useMyAssignmentsQuery } from "@buildingai/services/web";
import { Button } from "@buildingai/ui/components/ui/button";
import { ClipboardCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { SubmitAssignmentDialog } from "./submit-assignment-dialog";
import { isAssignmentOpen } from "./utils";

/**
 * 「提交到课堂任务」按钮，挂在工作流编辑器与智能体发布页。
 *
 * 没有可提交的任务时整个按钮不渲染 —— 个人空间用户和没被指派任务的学生
 * 不该看到一个点开就是空的入口。
 */
export function QuickSubmitButton({
  targetType,
  targetId,
  targetName,
  size = "sm",
  variant = "outline",
  className,
}: {
  targetType: AssignmentTargetType;
  targetId: string;
  targetName?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // 个人空间没有班级作业，直接跳过请求。
  const inOrganization = Boolean(getActiveOrganizationId());
  const { data: assignments = [] } = useMyAssignmentsQuery({ enabled: inOrganization });

  const available = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          isAssignmentOpen(assignment) && assignment.allowedTypes.includes(targetType),
      ).length,
    [assignments, targetType],
  );

  if (!inOrganization || !available || !targetId) return null;

  return (
    <>
      <Button size={size} variant={variant} className={className} onClick={() => setOpen(true)}>
        <ClipboardCheck /> 提交到任务
      </Button>
      <SubmitAssignmentDialog
        targetType={targetType}
        targetId={targetId}
        targetName={targetName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
