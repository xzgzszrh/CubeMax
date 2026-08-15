import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import { OrganizationPermission } from "@buildingai/services/web";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { Bot, Cable } from "lucide-react";

import { XiaozhiDevicePanel } from "@/components/settings-dialog/settings-items/xiaozhi-device-panel";
import { XiaozhiMcpSetting } from "@/components/settings-dialog/settings-items/xiaozhi-mcp-setting";
import { usePodiumWorkspace } from "@/hooks/use-podium-workspace";

import { PodiumPage } from "../_components/podium-page";

export const meta = definePageMeta({
  title: "设备管理",
  description: "绑定方糖猫账号、分发智能体与接入 MCP",
  icon: "bot",
});

const PodiumDevicesPage = () => {
  useDocumentHead({ title: "设备管理" });
  const workspace = usePodiumWorkspace();
  const canManageAssets = workspace.can(OrganizationPermission.ASSET_MANAGE);
  const canReadMembers = workspace.can(OrganizationPermission.MEMBER_READ);

  return (
    <PodiumPage
      title="设备管理"
      description="绑定方糖猫账号、把智能体分发给学生，并接入 MCP 工具。"
    >
      <Tabs defaultValue="devices">
        <TabsList variant="line">
          <TabsTrigger value="devices">
            <Bot /> 方糖猫
          </TabsTrigger>
          {canManageAssets ? (
            <TabsTrigger value="mcp">
              <Cable /> MCP 接入
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="devices" className="pt-2">
          <XiaozhiDevicePanel
            organizationId={workspace.organizationId}
            canManageAssets={canManageAssets}
            canReadMembers={canReadMembers}
          />
        </TabsContent>

        {canManageAssets ? (
          <TabsContent value="mcp" className="pt-2">
            <XiaozhiMcpSetting canManage={canManageAssets} />
          </TabsContent>
        ) : null}
      </Tabs>
    </PodiumPage>
  );
};

export default PodiumDevicesPage;
