import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import { OrganizationPermission, useXiaozhiAgentsQuery } from "@buildingai/services/web";

import { XiaozhiSceneManager } from "@/components/settings-dialog/settings-items/xiaozhi-automation-setting";
import { usePodiumWorkspace } from "@/hooks/use-podium-workspace";

import { PodiumPage } from "../_components/podium-page";

export const meta = definePageMeta({
  title: "场景",
  description: "保存完整角色配置，一键覆盖到任意智能体",
  icon: "blocks",
});

const PodiumScenesPage = () => {
  useDocumentHead({ title: "场景" });
  const workspace = usePodiumWorkspace();
  const canManage = workspace.can(OrganizationPermission.ASSET_MANAGE);
  const { data: agents = [] } = useXiaozhiAgentsQuery();

  return (
    <PodiumPage title="场景" description="保存完整角色配置，一键覆盖到任意智能体。">
      <XiaozhiSceneManager canManage={canManage} agents={agents} hideHeading />
    </PodiumPage>
  );
};

export default PodiumScenesPage;
