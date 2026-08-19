import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import type { AppGrantInput, GrantableApp } from "@buildingai/services/web";
import {
  useAppGrantsQuery,
  useOrganizationMembersQuery,
  useSaveAppGrantsMutation,
  useUpdateAppWhitelistMutation,
} from "@buildingai/services/web";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
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
import { LayoutGrid, LoaderCircle, Pin, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { usePodiumWorkspace } from "@/hooks/use-podium-workspace";

import { PodiumPage } from "../_components/podium-page";

export const meta = definePageMeta({
  title: "班级应用管理",
  description: "为学生安装应用，或按学生控制应用可见范围",
  icon: "layout-grid",
});

function appKey(app: Pick<GrantableApp, "appType" | "appRefId">) {
  return `${app.appType}:${app.appRefId}`;
}

/** 前端用 `appKey -> (userId | "*")` 的集合表示授权矩阵，提交时再摊平。 */
type GrantState = Map<string, Set<string>>;
type SidebarRequiredState = Set<string>;

const CLASS_TOKEN = "*";

const PodiumAppsPage = () => {
  useDocumentHead({ title: "班级应用管理" });
  const workspace = usePodiumWorkspace();
  const organizationId = workspace.organizationId;

  const { data: matrix, isLoading } = useAppGrantsQuery();
  const { data: members = [] } = useOrganizationMembersQuery(organizationId, "", {
    enabled: Boolean(organizationId),
  });

  const [grants, setGrants] = useState<GrantState>(new Map());
  const [sidebarRequired, setSidebarRequired] = useState<SidebarRequiredState>(new Set());
  const [keyword, setKeyword] = useState("");
  const [dirty, setDirty] = useState(false);

  // 服务端数据到达（或切换班级）后重置本地编辑态。
  useEffect(() => {
    if (!matrix) return;
    const next: GrantState = new Map();
    const nextSidebarRequired = new Set<string>();
    for (const item of matrix.items) {
      const targets = new Set(item.grantedUserIds);
      if (item.grantedToClass) targets.add(CLASS_TOKEN);
      if (targets.size) next.set(appKey(item), targets);
      if (item.sidebarRequiredToClass) nextSidebarRequired.add(appKey(item));
    }
    setGrants(next);
    setSidebarRequired(nextSidebarRequired);
    setDirty(false);
  }, [matrix]);

  const students = useMemo(
    () => members.filter((member) => member.roles.includes("student")),
    [members],
  );

  const visibleApps = useMemo(() => {
    const items = matrix?.items ?? [];
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return items;
    return items.filter((item) => item.name.toLowerCase().includes(trimmed));
  }, [matrix, keyword]);

  const saveGrants = useSaveAppGrantsMutation({
    onSuccess: () => {
      toast.success("授权已保存");
      setDirty(false);
    },
  });
  const updateWhitelist = useUpdateAppWhitelistMutation({
    onSuccess: (result: { enabled: boolean }) =>
      toast.success(result.enabled ? "已开启应用白名单" : "已关闭应用白名单"),
  });

  function toggle(app: GrantableApp, target: string) {
    setDirty(true);
    setGrants((previous) => {
      const next = new Map(previous);
      const key = appKey(app);
      const targets = new Set(next.get(key) ?? []);
      if (targets.has(target)) targets.delete(target);
      else targets.add(target);
      if (targets.size) next.set(key, targets);
      else next.delete(key);
      return next;
    });
  }

  function toggleSidebarRequired(app: GrantableApp) {
    const key = appKey(app);
    setDirty(true);
    setSidebarRequired((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    // A forced sidebar app must also be available to the whole organization.
    if (!grants.get(key)?.has(CLASS_TOKEN)) toggle(app, CLASS_TOKEN);
  }

  function submit() {
    const payload: AppGrantInput[] = [];
    for (const app of matrix?.items ?? []) {
      const targets = grants.get(appKey(app));
      const key = appKey(app);
      const nextTargets = new Set(targets ?? []);
      if (sidebarRequired.has(key)) nextTargets.add(CLASS_TOKEN);
      if (!nextTargets.size) continue;
      for (const target of nextTargets) {
        payload.push({
          appType: app.appType,
          appRefId: app.appRefId,
          userId: target === CLASS_TOKEN ? null : target,
          sidebarRequired:
            target === CLASS_TOKEN
              ? sidebarRequired.has(key)
              : app.sidebarRequiredUserIds.includes(target),
        });
      }
    }
    saveGrants.mutate(payload);
  }

  if (isLoading) {
    return (
      <PodiumPage title="班级应用管理">
        <div className="flex min-h-40 items-center justify-center">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      </PodiumPage>
    );
  }

  return (
    <PodiumPage
      title="班级应用管理"
      description="勾选「整班」即可开放应用；勾选「强制置顶」后，组织成员的侧边栏会始终保留该应用。"
      actions={
        <Button loading={saveGrants.isPending} disabled={!dirty} onClick={submit}>
          <Save /> 保存授权
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
        <div className="flex items-center gap-3">
          <Switch
            id="app-whitelist"
            checked={matrix?.whitelistEnabled ?? false}
            disabled={updateWhitelist.isPending}
            onCheckedChange={(checked) => updateWhitelist.mutate(checked)}
          />
          <div>
            <Label htmlFor="app-whitelist">仅显示已授权的应用</Label>
            <p className="text-muted-foreground text-xs">
              关闭时班级成员可以看到应用中心的全部应用，授权只作为记录。
            </p>
          </div>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索应用名称"
          />
        </div>
      </div>

      {visibleApps.length ? (
        <div className="overflow-auto border-y">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">应用</TableHead>
                <TableHead className="w-20 text-center">整班</TableHead>
                <TableHead className="w-28 text-center">
                  <span className="inline-flex items-center gap-1">
                    <Pin className="size-3.5" /> 强制置顶
                  </span>
                </TableHead>
                {students.map((student) => (
                  <TableHead key={student.userId} className="w-24">
                    <div className="flex flex-col items-center gap-1">
                      <Avatar className="size-6 rounded-md">
                        <AvatarImage src={student.avatar} />
                        <AvatarFallback className="rounded-md text-[10px]">
                          {(student.realName || student.nickname || student.username).slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-20 truncate text-xs font-normal">
                        {student.realName || student.nickname}
                      </span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleApps.map((app) => {
                const targets = grants.get(appKey(app)) ?? new Set<string>();
                const grantedToClass = targets.has(CLASS_TOKEN);
                const sidebarPinned = sidebarRequired.has(appKey(app));
                return (
                  <TableRow key={appKey(app)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="bg-muted flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md">
                          {app.icon ? (
                            <img src={app.icon} alt={app.name} className="size-full object-cover" />
                          ) : (
                            <LayoutGrid className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="max-w-48 truncate font-medium">{app.name}</p>
                            <Badge variant="outline">
                              {app.appType === "system"
                                ? "系统应用"
                                : app.appType === "workflow"
                                  ? "工作流"
                                  : "应用"}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground max-w-64 truncate text-xs">
                            {app.description || "无描述"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={grantedToClass}
                        onCheckedChange={() => toggle(app, CLASS_TOKEN)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={sidebarPinned}
                        onCheckedChange={() => toggleSidebarRequired(app)}
                      />
                    </TableCell>
                    {students.map((student) => (
                      <TableCell key={student.userId} className="text-center">
                        <Checkbox
                          checked={grantedToClass || targets.has(student.userId)}
                          disabled={grantedToClass}
                          onCheckedChange={() => toggle(app, student.userId)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-y text-center">
          <LayoutGrid className="text-muted-foreground size-7" />
          <p className="font-medium">{keyword.trim() ? "没有匹配的应用" : "暂无可授权的应用"}</p>
          <p className="text-muted-foreground max-w-sm text-xs">
            管理员在「管理员工作台 ·
            应用管理」安装应用后，这里就能分配给学生；你自己发布的工作流也会出现在列表中。
          </p>
        </div>
      )}

      {!students.length ? (
        <p className="text-muted-foreground text-xs">
          班级里还没有学生，先到「人员管理」创建或导入学生账号。
        </p>
      ) : null}
    </PodiumPage>
  );
};

export default PodiumAppsPage;
