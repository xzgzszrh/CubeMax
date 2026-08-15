import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import { OrganizationPermission, useXiaozhiAgentsQuery } from "@buildingai/services/web";

import { XiaozhiQuickCommandManager } from "@/components/settings-dialog/settings-items/xiaozhi-automation-setting";
import { usePodiumWorkspace } from "@/hooks/use-podium-workspace";

import { PodiumPage } from "../_components/podium-page";

export const meta = definePageMeta({
  title: "快捷指令",
  description: "组合场景与目标智能体，一次执行批量切换",
  icon: "zap",
});

const PodiumCommandsPage = () => {
  useDocumentHead({ title: "快捷指令" });
  const workspace = usePodiumWorkspace();
  const canManage = workspace.can(OrganizationPermission.ASSET_MANAGE);
  const { data: agents = [] } = useXiaozhiAgentsQuery();

  return (
    <PodiumPage title="快捷指令" description="组合一个场景和一组目标智能体，一次执行批量切换。">
      <XiaozhiQuickCommandManager canManage={canManage} agents={agents} hideHeading />
    </PodiumPage>
  );
};

export default PodiumCommandsPage;
