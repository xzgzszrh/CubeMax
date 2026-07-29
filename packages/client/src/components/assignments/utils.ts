import type { AssignmentTargetType } from "@buildingai/services/web";

export const TARGET_LABELS: Record<AssignmentTargetType, string> = {
  workflow: "工作流",
  agent: "智能体",
};

export function formatAssignmentTime(value: string | null | undefined) {
  if (!value) return "不限";
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "不限" : new Date(parsed).toLocaleString();
}

/** 作业当前是否还能提交：已发布且未过截止时间。 */
export function isAssignmentOpen(assignment: { status: string; dueAt: string | null }) {
  if (assignment.status !== "published") return false;
  if (!assignment.dueAt) return true;
  const due = Date.parse(assignment.dueAt);
  return Number.isNaN(due) || due > Date.now();
}
