import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import {
  OrganizationPermission,
  OrganizationRole,
  type OrganizationRoleType,
  useAddOrganizationMemberMutation,
  useCreateManagedAccountsMutation,
  useImportManagedAccountsMutation,
  useOrganizationMembersQuery,
  useSearchOrganizationUsersQuery,
  useUpdateOrganizationMemberMutation,
} from "@buildingai/services/web";
import { useAuthStore } from "@buildingai/stores";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { Check, LoaderCircle, Plus, Search, Upload, UserPlus, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { usePodiumWorkspace } from "@/hooks/use-podium-workspace";

import { PodiumPage } from "../_components/podium-page";

export const meta = definePageMeta({
  title: "人员管理",
  description: "管理班级成员身份，创建或导入学生账号",
  icon: "users",
});

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

type CredentialsState = Array<{
  userId: string;
  username: string;
  nickname: string;
  password: string;
}>;

function RoleBadges({ roles }: { roles: OrganizationRoleType[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} variant={role === OrganizationRole.STUDENT ? "secondary" : "outline"}>
          {ROLE_LABELS[role]}
        </Badge>
      ))}
    </div>
  );
}

const PodiumMembersPage = () => {
  useDocumentHead({ title: "人员管理" });
  const { userInfo } = useAuthStore((state) => state.auth);
  const workspace = usePodiumWorkspace();
  const organizationId = workspace.organizationId;

  const [memberKeyword, setMemberKeyword] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [subaccountOpen, setSubaccountOpen] = useState(false);
  const [subaccount, setSubaccount] = useState({ username: "", nickname: "", password: "" });
  const [credentials, setCredentials] = useState<CredentialsState>([]);
  const importRef = useRef<HTMLInputElement>(null);

  const canManageMembers = workspace.can(OrganizationPermission.MEMBER_MANAGE);

  const { data: members = [], isLoading } = useOrganizationMembersQuery(organizationId, "", {
    enabled: Boolean(organizationId),
  });
  const { data: searchResults = [] } = useSearchOrganizationUsersQuery(
    organizationId,
    searchKeyword,
    { enabled: addMemberOpen },
  );

  const visibleMembers = useMemo(() => {
    const keyword = memberKeyword.trim().toLowerCase();
    if (!keyword) return members;
    return members.filter((member) =>
      [member.realName, member.nickname, member.username].some((field) =>
        field?.toLowerCase().includes(keyword),
      ),
    );
  }, [memberKeyword, members]);

  const addMember = useAddOrganizationMemberMutation(organizationId, {
    onSuccess: () => {
      toast.success("成员已添加");
      setAddMemberOpen(false);
      setSearchKeyword("");
    },
  });
  const updateMember = useUpdateOrganizationMemberMutation(organizationId, {
    onSuccess: () => toast.success("成员身份已更新"),
  });
  const createManagedAccounts = useCreateManagedAccountsMutation(organizationId, {
    onSuccess: (result: { credentials: CredentialsState }) => {
      setCredentials(result.credentials);
      setSubaccountOpen(false);
      setSubaccount({ username: "", nickname: "", password: "" });
      toast.success("学生子账号已创建");
    },
  });
  const importManagedAccounts = useImportManagedAccountsMutation(organizationId, {
    onSuccess: (result: { credentials: CredentialsState }) => {
      setCredentials(result.credentials);
      toast.success(`已导入 ${result.credentials.length} 个学生账号`);
    },
  });

  function toggleRole(memberId: string, roles: OrganizationRoleType[], role: OrganizationRoleType) {
    const nextRoles = roles.includes(role)
      ? roles.filter((item) => item !== role)
      : [...roles, role];
    if (!nextRoles.length) {
      toast.error("成员至少需要一个身份");
      return;
    }
    updateMember.mutate({ memberId, roles: nextRoles });
  }

  return (
    <PodiumPage
      title="人员管理"
      description={
        workspace.organization
          ? `${workspace.organization.name} · 组织编号 ${workspace.organization.code}`
          : "管理班级成员身份，创建或导入学生账号"
      }
      actions={
        canManageMembers ? (
          <>
            <Button variant="outline" onClick={() => setAddMemberOpen(true)}>
              <UserPlus /> 添加账号
            </Button>
            <Button variant="outline" onClick={() => setSubaccountOpen(true)}>
              <Plus /> 创建学生
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importManagedAccounts.mutate(file);
                event.target.value = "";
              }}
            />
            <Button
              variant="outline"
              loading={importManagedAccounts.isPending}
              onClick={() => importRef.current?.click()}
            >
              <Upload /> 批量导入
            </Button>
          </>
        ) : null
      }
    >
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
        <Input
          className="pl-8"
          value={memberKeyword}
          onChange={(event) => setMemberKeyword(event.target.value)}
          placeholder="搜索姓名或账号"
        />
      </div>

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center border-y">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      ) : visibleMembers.length ? (
        <div className="overflow-auto border-y">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>成员</TableHead>
                <TableHead>账号类型</TableHead>
                <TableHead>组织身份</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMembers.map((member) => (
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
                        <p className="max-w-44 truncate font-medium">
                          {member.realName || member.nickname}
                          {member.userId === userInfo?.id ? "（我）" : ""}
                        </p>
                        <p className="text-muted-foreground max-w-44 truncate text-xs">
                          {member.username}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {member.memberType === "managed"
                        ? "托管子账号"
                        : member.memberType === "owner"
                          ? "组织创建人"
                          : "普通账号"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {canManageMembers && member.memberType !== "owner" ? (
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
                    ) : (
                      <RoleBadges roles={member.roles} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-y text-center">
          <Users className="text-muted-foreground size-7" />
          <p className="font-medium">{memberKeyword.trim() ? "没有匹配的成员" : "暂无成员"}</p>
          <p className="text-muted-foreground max-w-sm text-xs">
            {memberKeyword.trim()
              ? `没有姓名或账号包含“${memberKeyword.trim()}”的成员。`
              : "添加普通账号或创建学生子账号。"}
          </p>
        </div>
      )}

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加普通账号</DialogTitle>
            <DialogDescription>被添加的个人账号可切换到本组织，也可主动退出。</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              className="pl-8"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="搜索用户名、昵称或姓名"
            />
          </div>
          <div className="max-h-64 overflow-auto border-y">
            {searchResults.map((candidate) => (
              <button
                type="button"
                className="hover:bg-muted flex w-full items-center gap-3 border-b px-2 py-3 text-left last:border-b-0"
                key={candidate.id}
                onClick={() =>
                  addMember.mutate({ userId: candidate.id, roles: [OrganizationRole.TEACHER] })
                }
              >
                <Avatar className="size-8 rounded-md">
                  <AvatarImage src={candidate.avatar} />
                  <AvatarFallback className="rounded-md">
                    {candidate.nickname.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{candidate.realName || candidate.nickname}</p>
                  <p className="text-muted-foreground truncate text-xs">{candidate.username}</p>
                </div>
                <UserPlus className="size-4" />
              </button>
            ))}
            {!searchResults.length ? (
              <p className="text-muted-foreground py-8 text-center text-sm">暂无可添加账号</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={subaccountOpen} onOpenChange={setSubaccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建学生子账号</DialogTitle>
            <DialogDescription>子账号没有个人空间，不能加入或退出其他组织。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={subaccount.username}
              onChange={(event) => setSubaccount({ ...subaccount, username: event.target.value })}
              placeholder="用户名（字母、数字或下划线）"
            />
            <Input
              value={subaccount.nickname}
              onChange={(event) => setSubaccount({ ...subaccount, nickname: event.target.value })}
              placeholder="姓名或昵称"
            />
            <Input
              type="password"
              value={subaccount.password}
              onChange={(event) => setSubaccount({ ...subaccount, password: event.target.value })}
              placeholder="密码（留空则自动生成）"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubaccountOpen(false)}>
              取消
            </Button>
            <Button
              loading={createManagedAccounts.isPending}
              onClick={() =>
                createManagedAccounts.mutate({
                  accounts: [
                    {
                      username: subaccount.username.trim(),
                      nickname: subaccount.nickname.trim(),
                      password: subaccount.password.trim() || undefined,
                    },
                  ],
                })
              }
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credentials.length > 0} onOpenChange={(open) => !open && setCredentials([])}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>子账号创建结果</DialogTitle>
            <DialogDescription>关闭后不再显示明文初始密码。</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-auto border-y">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>初始密码</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((credential) => (
                  <TableRow key={credential.userId}>
                    <TableCell>{credential.nickname}</TableCell>
                    <TableCell>{credential.username}</TableCell>
                    <TableCell className="font-mono">{credential.password}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentials([])}>
              <Check /> 已记录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PodiumPage>
  );
};

export default PodiumMembersPage;
