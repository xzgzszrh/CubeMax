import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import { OrganizationPermission } from "@buildingai/services/web";

import { ClassroomSetting } from "@/components/settings-dialog/settings-items/classroom-setting";
import { usePodiumWorkspace } from "@/hooks/use-podium-workspace";

import { PodiumPage } from "../_components/podium-page";

export const meta = definePageMeta({
  title: "课堂活动",
  description: "主持课堂互动并投放公开大屏",
  icon: "presentation",
});

const PodiumActivitiesPage = () => {
  useDocumentHead({ title: "课堂活动" });
  const workspace = usePodiumWorkspace();

  return (
    <PodiumPage title="课堂活动" description="创建课堂互动、开始活动，并把公开大屏投到教室屏幕。">
      <ClassroomSetting canManage={workspace.can(OrganizationPermission.ASSET_MANAGE)} />
    </PodiumPage>
  );
};

export default PodiumActivitiesPage;
