import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import {
  getActiveOrganizationId,
  setActiveOrganizationId,
  useWorkspaceContextQuery,
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
import { Bot, Building2, CircleUserRound, ClipboardList, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MyAssignmentList } from "@/components/assignments";
import { CubeCatDeviceManager } from "@/components/settings-dialog/settings-items/my-cubecat-setting";

export const meta = definePageMeta({
  title: "课堂",
  description: "查看我的方糖猫设备与老师布置的任务",
  icon: "presentation",
});

/**
 * 学生视角的课堂页：只有「我的方糖猫」和「我的任务」。
 * 老师的完整教学管理在左下角「讲台」（/podium）。
 */
const ClassroomPage = () => {
  useDocumentHead({ title: "课堂" });
  const queryClient = useQueryClient();
  const { data: context, isLoading } = useWorkspaceContextQuery();
  const [activeOrganizationId, setActiveId] = useState<string | null>(() =>
    getActiveOrganizationId(),
  );

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
              查看分配给你的方糖猫，以及老师布置的任务。
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

        <Tabs defaultValue="devices">
          <TabsList variant="line">
            <TabsTrigger value="devices">
              <Bot /> 我的方糖猫
            </TabsTrigger>
            {activeOrganizationId ? (
              <TabsTrigger value="assignments">
                <ClipboardList /> 我的任务
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="devices" className="pt-2">
            <CubeCatDeviceManager />
          </TabsContent>

          {activeOrganizationId ? (
            <TabsContent value="assignments" className="pt-2">
              <MyAssignmentList />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </ScrollArea>
  );
};

export default ClassroomPage;
