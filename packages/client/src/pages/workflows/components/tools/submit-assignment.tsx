/**
 * 工作流编辑器工具栏上的「提交到任务」入口。
 *
 * 只有当前工作空间是班级、且存在一份还能提交、接受工作流的任务时才渲染，
 * 否则个人空间用户会看到一个点开就是空的按钮。
 */
import { getActiveOrganizationId, useMyAssignmentsQuery } from "@buildingai/services/web";
import { Button as SemiButton, Tooltip } from "@douyinfe/semi-ui";
import { ClipboardCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { SubmitAssignmentDialog } from "@/components/assignments";
import { isAssignmentOpen } from "@/components/assignments/utils";

import { useWorkflowSave } from "../../context";

export function SubmitAssignmentTool({ disabled = false }: { disabled?: boolean }) {
  const { workflowId } = useWorkflowSave();
  const [open, setOpen] = useState(false);

  const inOrganization = Boolean(getActiveOrganizationId());
  const { data: assignments = [] } = useMyAssignmentsQuery({ enabled: inOrganization });

  const available = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          isAssignmentOpen(assignment) && assignment.allowedTypes.includes("workflow"),
      ).length,
    [assignments],
  );

  if (!inOrganization || !available || !workflowId) return null;

  return (
    <>
      <Tooltip content={`有 ${available} 个任务可提交`}>
        <SemiButton
          theme="borderless"
          type="tertiary"
          disabled={disabled}
          icon={<ClipboardCheck size={16} />}
          onClick={() => setOpen(true)}
        >
          提交到任务
        </SemiButton>
      </Tooltip>
      <SubmitAssignmentDialog
        targetType="workflow"
        targetId={workflowId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
