import {
  type ConsoleOrganization,
  useConsoleCreateOrganizationMutation,
  useConsoleOrganizationsQuery,
  useConsoleOwnerCandidatesQuery,
  useConsoleUpdateOrganizationMutation,
} from "@buildingai/services/console";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
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
import { Switch } from "@buildingai/ui/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { Building2, Plus, Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/layouts/console/_components/page-container";

import { OrganizationMembersDialog } from "./_components/organization-members-dialog";

const TeachingOrganizationPage = () => {
  const [keyword, setKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [ownerKeyword, setOwnerKeyword] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [membersTarget, setMembersTarget] = useState<ConsoleOrganization | null>(null);

  const { data: organizations = [], isLoading } = useConsoleOrganizationsQuery(keyword);
  const { data: candidates = [] } = useConsoleOwnerCandidatesQuery(ownerKeyword, {
    enabled: createOpen,
  });

  const createOrganization = useConsoleCreateOrganizationMutation({
    onSuccess: () => {
      toast.success("组织已创建");
      setCreateOpen(false);
      setName("");
      setOwnerId(null);
      setOwnerKeyword("");
    },
  });
  const updateOrganization = useConsoleUpdateOrganizationMutation({
    onSuccess: () => toast.success("已更新"),
  });

  return (
    <PageContainer>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索组织名称或编号"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> 创建组织
        </Button>
      </div>

      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>组织</TableHead>
              <TableHead>负责人</TableHead>
              <TableHead className="text-right">成员</TableHead>
              <TableHead className="text-right">方糖猫</TableHead>
              <TableHead className="text-right">额度余额</TableHead>
              <TableHead>应用白名单</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                  加载中…
                </TableCell>
              </TableRow>
            ) : organizations.length ? (
              organizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                        <Building2 className="size-4" />
                      </div>
                      <div>
                        <p className="font-medium">{organization.name}</p>
                        <p className="text-muted-foreground text-xs">编号 {organization.code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{organization.ownerName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {organization.memberCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {organization.agentCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {organization.quotaBalance}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={organization.appWhitelistEnabled}
                      disabled={updateOrganization.isPending}
                      onCheckedChange={(checked) =>
                        updateOrganization.mutate({
                          organizationId: organization.id,
                          appWhitelistEnabled: checked,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={organization.isActive ? "secondary" : "outline"}>
                      {organization.isActive ? "启用" : "已停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <TimeText value={organization.createdAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMembersTarget(organization)}
                      >
                        <Users /> 成员
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={updateOrganization.isPending}
                        onClick={() =>
                          updateOrganization.mutate({
                            organizationId: organization.id,
                            isActive: !organization.isActive,
                          })
                        }
                      >
                        {organization.isActive ? "停用" : "启用"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground h-24 text-center">
                  暂无组织
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建组织</DialogTitle>
            <DialogDescription>
              指定的负责人会自动成为该组织的管理员；不选则由你自己担任。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="organization-name">组织名称</Label>
              <Input
                id="organization-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：初二（3）班"
                maxLength={80}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="organization-owner">负责人（可选）</Label>
              <Input
                id="organization-owner"
                value={ownerKeyword}
                onChange={(event) => setOwnerKeyword(event.target.value)}
                placeholder="搜索用户名、昵称或姓名"
              />
              <div className="max-h-48 overflow-auto border">
                {candidates.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.id}
                    className={`hover:bg-muted flex w-full items-center gap-2 border-b px-2 py-2 text-left last:border-b-0 ${
                      ownerId === candidate.id ? "bg-muted" : ""
                    }`}
                    onClick={() => setOwnerId(candidate.id)}
                  >
                    <Avatar className="size-7 rounded-md">
                      <AvatarImage src={candidate.avatar} />
                      <AvatarFallback className="rounded-md text-xs">
                        {(candidate.realName || candidate.nickname).slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{candidate.realName || candidate.nickname}</p>
                      <p className="text-muted-foreground truncate text-xs">{candidate.username}</p>
                    </div>
                    {ownerId === candidate.id ? <Badge variant="secondary">已选</Badge> : null}
                  </button>
                ))}
                {!candidates.length ? (
                  <p className="text-muted-foreground py-6 text-center text-sm">暂无匹配账号</p>
                ) : null}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              loading={createOrganization.isPending}
              disabled={name.trim().length < 2}
              onClick={() =>
                createOrganization.mutate({
                  name: name.trim(),
                  ownerId: ownerId ?? undefined,
                })
              }
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrganizationMembersDialog
        organization={membersTarget}
        onClose={() => setMembersTarget(null)}
      />
    </PageContainer>
  );
};

export default TeachingOrganizationPage;
