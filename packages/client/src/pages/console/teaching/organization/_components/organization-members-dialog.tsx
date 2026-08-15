import {
  type ConsoleOrganization,
  useConsoleOrganizationMembersQuery,
  useConsoleRemoveMemberMutation,
  useConsoleUpdateMemberRolesMutation,
} from "@buildingai/services/console";
import type { OrganizationRoleType } from "@buildingai/services/web";
import { OrganizationRole } from "@buildingai/services/web";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<OrganizationRoleType, string> = {
  student: "学生",
  teacher: "老师",
  admin: "管理员",
  school_admin: "学校管理员",
};

const EDITABLE_ROLES: OrganizationRoleType[] = [
  OrganizationRole.STUDENT,
  OrganizationRole.TEACHER,
  OrganizationRole.ADMIN,
  OrganizationRole.SCHOOL_ADMIN,
];

/** 后台的成员与角色分配，可跨组织操作，不受当前登录者的组织身份限制。 */
export function OrganizationMembersDialog({
  organization,
  onClose,
}: {
  organization: ConsoleOrganization | null;
  onClose: () => void;
}) {
  const { confirm } = useAlertDialog();
  const { data: members = [], isLoading } = useConsoleOrganizationMembersQuery(
    organization?.id ?? null,
  );

  const updateRoles = useConsoleUpdateMemberRolesMutation({
    onSuccess: () => toast.success("身份已更新"),
  });
  const removeMember = useConsoleRemoveMemberMutation({
    onSuccess: () => toast.success("成员已移出"),
  });

  function toggleRole(memberId: string, roles: OrganizationRoleType[], role: OrganizationRoleType) {
    const nextRoles = roles.includes(role)
      ? roles.filter((item) => item !== role)
      : [...roles, role];
    if (!nextRoles.length) {
      toast.error("成员至少需要一个身份");
      return;
    }
    if (!organization) return;
    updateRoles.mutate({ organizationId: organization.id, memberId, roles: nextRoles });
  }

  return (
    <Dialog open={Boolean(organization)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{organization?.name} · 成员</DialogTitle>
          <DialogDescription>
            勾选身份即刻生效；组织创建人的身份不可修改，也不能被移出。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>成员</TableHead>
                <TableHead className="text-right">额度</TableHead>
                <TableHead>组织身份</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-20 text-center">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : members.length ? (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8 rounded-md">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="rounded-md">
                            {(member.realName || member.nickname || member.username).slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="max-w-40 truncate font-medium">
                              {member.realName || member.nickname}
                            </p>
                            {member.memberType === "owner" ? (
                              <Badge variant="outline">创建人</Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground max-w-40 truncate text-xs">
                            {member.username}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{member.power}</TableCell>
                    <TableCell>
                      {member.memberType === "owner" ? (
                        <div className="flex flex-wrap gap-1">
                          {member.roles.map((role) => (
                            <Badge key={role} variant="outline">
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="flex max-w-72 flex-wrap gap-x-3 gap-y-2">
                          {EDITABLE_ROLES.map((role) => (
                            <label className="flex items-center gap-1.5 text-xs" key={role}>
                              <Checkbox
                                checked={member.roles.includes(role)}
                                onCheckedChange={() => toggleRole(member.id, member.roles, role)}
                              />
                              {ROLE_LABELS[role]}
                            </label>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.memberType === "owner" ? null : (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          title="移出组织"
                          onClick={async () => {
                            await confirm({
                              title: "移出成员",
                              description: `确定把「${member.realName || member.nickname}」移出 ${organization?.name} 吗？`,
                            });
                            if (!organization) return;
                            removeMember.mutate({
                              organizationId: organization.id,
                              memberId: member.id,
                            });
                          }}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground h-20 text-center">
                    暂无成员
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
