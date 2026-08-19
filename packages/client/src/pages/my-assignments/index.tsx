import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Building2, CircleUserRound, ClipboardList, LoaderCircle } from "lucide-react";

import { MyAssignmentList } from "@/components/assignments";
import { usePodiumWorkspace } from "@/hooks/use-podium-workspace";

import { PageShell } from "../_components/page-shell";

export const meta = definePageMeta({
  title: "我的任务",
  description: "查看并提交老师布置的课堂任务",
  icon: "clipboard-list",
});

/**
 * 学生的任务中心。老师批阅后的评分与评语也在这里查看。
 */
const MyAssignmentsPage = () => {
  useDocumentHead({ title: "我的任务" });
  const workspace = usePodiumWorkspace();

  if (workspace.isLoading) {
    return (
      <PageShell
        icon={ClipboardList}
        eyebrow="课堂任务"
        title="我的任务"
        description="查看并提交老师布置的课堂任务"
      >
        <div className="flex min-h-72 items-center justify-center">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      icon={ClipboardList}
      eyebrow="课堂任务"
      title="我的任务"
      description="提交你做的工作流或智能体，老师批阅后可以在这里看到评分和评语。"
      className="max-w-7xl"
      actions={
        <Select
          value={workspace.organizationId || "personal"}
          onValueChange={(value) => workspace.switchWorkspace(value === "personal" ? null : value)}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {workspace.hasPersonalWorkspace ? (
              <SelectItem value="personal">
                <span className="flex items-center gap-2">
                  <CircleUserRound className="size-4" />
                  个人空间
                </span>
              </SelectItem>
            ) : null}
            {workspace.organizations.map((organization) => (
              <SelectItem value={organization.id} key={organization.id}>
                <span className="flex items-center gap-2">
                  <Building2 className="size-4" />
                  {organization.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {workspace.organizationId ? (
        <MyAssignmentList emptyHint="老师在讲台的「班级任务列表」里发布任务后，这里就会出现。" />
      ) : (
        <div className="bg-background flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border-dashed text-center shadow-xs">
          <ClipboardList className="text-muted-foreground size-7" />
          <p className="font-medium">当前是个人空间</p>
          <p className="text-muted-foreground max-w-sm text-xs">
            课堂任务属于班级，请在右上角切换到你所在的班级。
          </p>
        </div>
      )}
    </PageShell>
  );
};

export default MyAssignmentsPage;
