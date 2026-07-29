import {
  getActiveOrganizationId,
  OrganizationRole,
  type OrganizationRoleType,
  setActiveOrganizationId,
  useCreateOrganizationMutation,
  useLeaveOrganizationMutation,
  useWorkspaceContextQuery,
  WORKSPACE_CHANGED_EVENT,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, CircleUserRound, LoaderCircle, LogOut, Plus, Presentation } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const ROLE_LABELS: Record<OrganizationRoleType, string> = {
  student: "学生",
  teacher: "老师",
  admin: "管理员",
  school_admin: "学校管理员",
};

/**
 * 工作空间设置：只负责在个人空间与各组织之间切换，以及创建/退出组织。
 * 人员管理、设备、场景、作业与额度都在左下角「讲台」里。
 */
export function WorkspaceSetting() {
  const queryClient = useQueryClient();
  const { data: context, isLoading } = useWorkspaceContextQuery();
  const [activeOrganizationId, setActiveId] = useState<string | null>(() =>
    getActiveOrganizationId(),
  );
  const [createOrganizationOpen, setCreateOrganizationOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");

  const activeOrganization = context?.organizations.find(
    (item) => item.id === activeOrganizationId,
  );

  // 其它位置（讲台侧边栏、课堂页）切换组织时同步过来。
  useEffect(() => {
    const handler = () => setActiveId(getActiveOrganizationId());
    window.addEventListener(WORKSPACE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_CHANGED_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!context) return;
    const validOrganization = context.organizations.some(
      (item) => item.id === activeOrganizationId,
    );
    if (validOrganization || (activeOrganizationId === null && context.personalWorkspace)) return;
    const fallback = context.personalWorkspace ? null : context.organizations[0]?.id || null;
    setActiveId(fallback);
    setActiveOrganizationId(fallback);
  }, [activeOrganizationId, context]);

  const createOrganization = useCreateOrganizationMutation({
    onSuccess: (organization: { id: string }) => {
      toast.success("组织已创建");
      setCreateOrganizationOpen(false);
      setOrganizationName("");
      switchWorkspace(organization.id);
    },
  });
  const leaveOrganization = useLeaveOrganizationMutation({
    onSuccess: () => {
      toast.success("已退出组织");
      switchWorkspace(
        context?.personalWorkspace
          ? null
          : context?.organizations.find((item) => item.id !== activeOrganizationId)?.id || null,
      );
    },
  });

  function switchWorkspace(organizationId: string | null) {
    setActiveOrganizationId(organizationId);
    setActiveId(organizationId);
    queryClient.removeQueries({ queryKey: ["xiaozhi"] });
    queryClient.removeQueries({ queryKey: ["classroom"] });
    queryClient.invalidateQueries({ queryKey: ["user", "info"] });
    queryClient.invalidateQueries({ queryKey: ["organizations"] });
    toast.success(organizationId ? "已切换组织" : "已切换个人空间");
  }

  if (isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium">当前工作空间</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              组织间的账号与方糖猫资产互相独立，切换后所有页面都会跟着变。
            </p>
          </div>
          {context?.personalWorkspace ? (
            <Button size="sm" variant="outline" onClick={() => setCreateOrganizationOpen(true)}>
              <Plus /> 创建组织
            </Button>
          ) : null}
        </div>
        <Select
          value={activeOrganizationId || "personal"}
          onValueChange={(value) => switchWorkspace(value === "personal" ? null : value)}
        >
          <SelectTrigger className="w-full px-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {context?.personalWorkspace ? (
              <SelectItem value="personal">
                <span className="flex items-center gap-2">
                  <CircleUserRound className="size-4" />
                  个人空间
                </span>
              </SelectItem>
            ) : null}
            {context?.organizations.map((organization) => (
              <SelectItem value={organization.id} key={organization.id}>
                <span className="flex items-center gap-2">
                  <Building2 className="size-4" />
                  {organization.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeOrganization ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">
                组织编号 {activeOrganization.code}
              </span>
              <div className="flex flex-wrap gap-1">
                {activeOrganization.roles.map((role) => (
                  <Badge
                    key={role}
                    variant={role === OrganizationRole.STUDENT ? "secondary" : "outline"}
                  >
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </div>
            </div>
            {activeOrganization.canLeave ? (
              <Button
                size="sm"
                variant="ghost"
                loading={leaveOrganization.isPending}
                onClick={() => leaveOrganization.mutate(activeOrganization.id)}
              >
                <LogOut /> 退出组织
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="border-t pt-4">
        <h3 className="font-medium">班级管理</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          人员管理、设备、场景、快捷指令、课堂活动、班级应用、作业与额度都在「讲台」里。
        </p>
        {/*
          设置弹窗挂在 RouterProvider 之外（见 main.tsx），这里不能用 <Link>，
          否则 useHref 会因为拿不到 Router 上下文而直接白屏。
        */}
        <Button className="mt-3" variant="outline" size="sm" asChild>
          <a href="/podium/members">
            <Presentation /> 打开讲台
          </a>
        </Button>
      </section>

      <Dialog open={createOrganizationOpen} onOpenChange={setCreateOrganizationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建组织</DialogTitle>
            <DialogDescription>组织当前按班级管理，创建人自动成为管理员。</DialogDescription>
          </DialogHeader>
          <Input
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="例如：初二（3）班"
            maxLength={80}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOrganizationOpen(false)}>
              取消
            </Button>
            <Button
              loading={createOrganization.isPending}
              disabled={organizationName.trim().length < 2}
              onClick={() => createOrganization.mutate({ name: organizationName.trim() })}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
