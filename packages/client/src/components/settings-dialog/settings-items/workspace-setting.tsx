import {
  getActiveOrganizationId,
  OrganizationPermission,
  OrganizationRole,
  type OrganizationRoleType,
  setActiveOrganizationId,
  useAddOrganizationMemberMutation,
  useCreateManagedAccountsMutation,
  useCreateOrganizationMutation,
  useImportManagedAccountsMutation,
  useLeaveOrganizationMutation,
  useOrganizationMembersQuery,
  useSearchOrganizationUsersQuery,
  useUpdateOrganizationMemberMutation,
  useWorkspaceContextQuery,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  CircleUserRound,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

type CredentialsState = Array<{
  userId: string;
  username: string;
  nickname: string;
  password: string;
}>;

function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Users;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-t text-center">
      <Icon className="text-muted-foreground size-7" />
      <p className="font-medium">{title}</p>
      {detail ? <p className="text-muted-foreground max-w-sm text-xs">{detail}</p> : null}
    </div>
  );
}

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

/**
 * Workspace settings: switch between personal space and organizations, and
 * manage organization members. Device / scene / classroom management lives on
 * the dedicated 课堂 page reachable from the app sidebar.
 */
export function WorkspaceSetting() {
  const queryClient = useQueryClient();
  const { userInfo } = useAuthStore((state) => state.auth);
  const { data: context, isLoading } = useWorkspaceContextQuery();
  const [activeOrganizationId, setActiveId] = useState<string | null>(() =>
    getActiveOrganizationId(),
  );
  const [createOrganizationOpen, setCreateOrganizationOpen] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [memberKeyword, setMemberKeyword] = useState("");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [subaccountOpen, setSubaccountOpen] = useState(false);
  const [subaccount, setSubaccount] = useState({ username: "", nickname: "", password: "" });
  const [credentials, setCredentials] = useState<CredentialsState>([]);
  const importRef = useRef<HTMLInputElement>(null);

  const activeOrganization = context?.organizations.find(
    (item) => item.id === activeOrganizationId,
  );
  const permissions = activeOrganization?.permissions ?? [];
  const canReadMembers = permissions.includes(OrganizationPermission.MEMBER_READ);
  const canManageMembers = permissions.includes(OrganizationPermission.MEMBER_MANAGE);

  const { data: members = [], isLoading: membersLoading } = useOrganizationMembersQuery(
    activeOrganizationId,
    "",
    { enabled: Boolean(activeOrganizationId && canReadMembers) },
  );
  const { data: searchResults = [] } = useSearchOrganizationUsersQuery(
    activeOrganizationId,
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
  const addMember = useAddOrganizationMemberMutation(activeOrganizationId, {
    onSuccess: () => {
      toast.success("成员已添加");
      setAddMemberOpen(false);
      setSearchKeyword("");
    },
  });
  const updateMember = useUpdateOrganizationMemberMutation(activeOrganizationId, {
    onSuccess: () => toast.success("成员身份已更新"),
  });
  const createManagedAccounts = useCreateManagedAccountsMutation(activeOrganizationId, {
    onSuccess: (result: { credentials: CredentialsState }) => {
      setCredentials(result.credentials);
      setSubaccountOpen(false);
      setSubaccount({ username: "", nickname: "", password: "" });
      toast.success("学生子账号已创建");
    },
  });
  const importManagedAccounts = useImportManagedAccountsMutation(activeOrganizationId, {
    onSuccess: (result: { credentials: CredentialsState }) => {
      setCredentials(result.credentials);
      toast.success(`已导入 ${result.credentials.length} 个学生账号`);
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

  if (isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section className="border-b pb-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-medium">当前工作空间</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              组织间账号与方糖猫资产独立管理，设备与课堂功能在左侧「课堂」页面。
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
              <RoleBadges roles={activeOrganization.roles} />
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

      {activeOrganizationId && canReadMembers ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
              <Input
                className="pl-8"
                value={memberKeyword}
                onChange={(event) => setMemberKeyword(event.target.value)}
                placeholder="搜索姓名或账号"
              />
            </div>
            {canManageMembers ? (
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
            ) : null}
          </div>
          {membersLoading ? (
            <EmptyState icon={LoaderCircle} title="正在读取成员" detail="" />
          ) : visibleMembers.length ? (
            <div className="max-h-[360px] overflow-auto border-y">
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
                              {(member.realName || member.nickname || member.username).slice(
                                0,
                                1,
                              )}
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
                                  onCheckedChange={() =>
                                    toggleRole(member.id, member.roles, role)
                                  }
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
            <EmptyState
              icon={Users}
              title={memberKeyword.trim() ? "没有匹配的成员" : "暂无成员"}
              detail={
                memberKeyword.trim()
                  ? `没有姓名或账号包含“${memberKeyword.trim()}”的成员。`
                  : "添加普通账号或创建学生子账号。"
              }
            />
          )}
        </section>
      ) : null}

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
    </div>
  );
}
