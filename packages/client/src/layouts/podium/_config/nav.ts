import { OrganizationPermission, type OrganizationPermissionType } from "@buildingai/services/web";
import type dynamicIconImports from "lucide-react/dynamicIconImports";

export type PodiumNavItem = {
  /** 相对 /podium 的路径片段。 */
  path: string;
  name: string;
  description: string;
  icon: keyof typeof dynamicIconImports;
  /** 需要的组织权限，缺少时该项对当前身份不可见。 */
  requiredPermission: OrganizationPermissionType;
};

export type PodiumNavGroup = {
  label: string;
  items: PodiumNavItem[];
};

export const PODIUM_BASE_PATH = "/podium";

export const PODIUM_NAV: PodiumNavGroup[] = [
  {
    label: "班级",
    items: [
      {
        path: "members",
        name: "人员管理",
        description: "管理班级成员身份，创建或导入学生账号",
        icon: "users",
        requiredPermission: OrganizationPermission.MEMBER_READ,
      },
      {
        path: "classroom-apps",
        name: "课堂应用",
        description: "启动课堂应用的教师控制端",
        icon: "app-window",
        requiredPermission: OrganizationPermission.ASSET_READ,
      },
      {
        path: "apps",
        name: "班级应用管理",
        description: "为学生安装应用，或按学生控制应用可见范围",
        icon: "layout-grid",
        requiredPermission: OrganizationPermission.ASSET_MANAGE,
      },
      {
        path: "assignments",
        name: "班级任务列表",
        description: "布置作业并预览学生提交的工作流与智能体",
        icon: "clipboard-list",
        requiredPermission: OrganizationPermission.ASSIGNMENT_PUBLISH,
      },
      {
        path: "quota",
        name: "额度管理",
        description: "查看班级 AI 额度，并给学生划拨或回收额度",
        icon: "wallet",
        requiredPermission: OrganizationPermission.QUOTA_ALLOCATE,
      },
    ],
  },
  {
    label: "教学设备",
    items: [
      {
        path: "devices",
        name: "设备管理",
        description: "绑定方糖猫账号、分发智能体与接入 MCP",
        icon: "bot",
        requiredPermission: OrganizationPermission.ASSET_READ,
      },
      {
        path: "scenes",
        name: "场景",
        description: "保存完整角色配置，一键覆盖到任意智能体",
        icon: "blocks",
        requiredPermission: OrganizationPermission.ASSET_READ,
      },
      {
        path: "commands",
        name: "快捷指令",
        description: "组合场景与目标智能体，一次执行批量切换",
        icon: "zap",
        requiredPermission: OrganizationPermission.ASSET_READ,
      },
      {
        path: "activities",
        name: "课堂活动",
        description: "主持课堂互动并投放公开大屏",
        icon: "presentation",
        requiredPermission: OrganizationPermission.ASSET_MANAGE,
      },
    ],
  },
];

export const PODIUM_NAV_ITEMS = PODIUM_NAV.flatMap((group) => group.items);

export function findPodiumNavItem(pathname: string) {
  return PODIUM_NAV_ITEMS.find((item) => pathname === `${PODIUM_BASE_PATH}/${item.path}`);
}

/** 当前身份可访问的导航项；权限为空（尚未加载）时返回空数组。 */
export function filterPodiumNav(permissions: OrganizationPermissionType[]): PodiumNavGroup[] {
  return PODIUM_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.includes(item.requiredPermission)),
  })).filter((group) => group.items.length > 0);
}
