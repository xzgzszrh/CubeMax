import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import {
  getActiveOrganizationId,
  OrganizationPermission,
  setActiveOrganizationId,
  useWorkspaceContextQuery,
  useXiaozhiAgentsQuery,
  WORKSPACE_CHANGED_EVENT,
} from "@buildingai/services/web";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import {
  Blocks,
  Bot,
  Building2,
  Cable,
  CircleUserRound,
  LoaderCircle,
  Presentation,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ClassroomSetting } from "@/components/settings-dialog/settings-items/classroom-setting";
import { XiaozhiAutomationSetting } from "@/components/settings-dialog/settings-items/xiaozhi-automation-setting";
import { XiaozhiDevicePanel } from "@/components/settings-dialog/settings-items/xiaozhi-device-panel";
import { XiaozhiMcpSetting } from "@/components/settings-dialog/settings-items/xiaozhi-mcp-setting";

export const meta = definePageMeta({
  title: "课堂",
  description: "方糖猫设备、场景与课堂互动管理",
  icon: "presentation",
});

type ClassroomTab = "activities" | "devices" | "automation" | "mcp";

const ClassroomPage = () => {
  useDocumentHead({ title: "课堂" });
  const queryClient = useQueryClient();
  const { data: context, isLoading } = useWorkspaceContextQuery();
  const [activeOrganizationId, setActiveId] = useState<string | null>(() =>
    getActiveOrganizationId(),
  );
  const [tab, setTab] = useState<ClassroomTab>("activities");

  // Stay in sync when the workspace is switched elsewhere (e.g. settings dialog).
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

  const activeOrganization = context?.organizations.find(
    (item) => item.id === activeOrganizationId,
  );
  const permissions = activeOrganization?.permissions ?? [];
  const canManageAssets = permissions.includes(OrganizationPermission.ASSET_MANAGE);
  const canReadMembers = permissions.includes(OrganizationPermission.MEMBER_READ);
  const canManage = canManageAssets || !activeOrganizationId;

  const { data: agents = [] } = useXiaozhiAgentsQuery({ enabled: Boolean(context) });

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
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">课堂</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              管理方糖猫设备、批量切换角色场景，并主持课堂互动。
            </p>
          </div>
          <Select
            value={activeOrganizationId || "personal"}
            onValueChange={(value) => switchWorkspace(value === "personal" ? null : value)}
          >
            <SelectTrigger className="w-52 px-3">
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
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as ClassroomTab)}>
          <TabsList variant="line">
            <TabsTrigger value="activities">
              <Presentation /> 课堂活动
            </TabsTrigger>
            <TabsTrigger value="devices">
              <Bot /> 方糖猫
            </TabsTrigger>
            {canManage ? (
              <TabsTrigger value="automation">
                <Blocks /> 自动化
              </TabsTrigger>
            ) : null}
            {canManage ? (
              <TabsTrigger value="mcp">
                <Cable /> MCP 接入
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="activities" className="pt-2">
            <ClassroomSetting canManage={canManage} />
          </TabsContent>

          <TabsContent value="devices" className="pt-2">
            <XiaozhiDevicePanel
              organizationId={activeOrganizationId}
              canManageAssets={canManageAssets}
              canReadMembers={canReadMembers}
            />
          </TabsContent>

          {canManage ? (
            <TabsContent value="automation" className="pt-2">
              <XiaozhiAutomationSetting canManage={canManage} agents={agents} />
            </TabsContent>
          ) : null}

          {canManage ? (
            <TabsContent value="mcp" className="pt-2">
              <XiaozhiMcpSetting canManage={canManage} />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </ScrollArea>
  );
};

export default ClassroomPage;
