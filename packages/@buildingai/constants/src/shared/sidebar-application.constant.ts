/**
 * Applications that are provided by the host platform rather than an extension.
 * Keep these identifiers stable: they are persisted in user preferences and
 * organization application grants.
 */
export const SidebarSystemApplicationType = "system" as const;

export const SIDEBAR_SYSTEM_APPLICATIONS = [
    {
        appType: SidebarSystemApplicationType,
        appRefId: "datasets",
        title: "知识库",
        description: "管理和使用知识库",
        icon: "book-search",
        path: "/datasets",
    },
    {
        appType: SidebarSystemApplicationType,
        appRefId: "smart-home",
        title: "智能家居",
        description: "查看和控制已连接的智能设备",
        icon: "house-plug",
        path: "/smart-home",
    },
    {
        appType: SidebarSystemApplicationType,
        appRefId: "my-assignments",
        title: "我的任务",
        description: "查看组织分配给你的任务",
        icon: "clipboard-list",
        path: "/my-assignments",
    },
    {
        appType: SidebarSystemApplicationType,
        appRefId: "triggers",
        title: "触发器",
        description: "通过表单快速执行编程工程",
        icon: "zap",
        path: "/triggers",
    },
] as const;

export type SidebarSystemApplication = (typeof SIDEBAR_SYSTEM_APPLICATIONS)[number];
export type SidebarApplicationType = typeof SidebarSystemApplicationType | "extension" | "workflow";

export type SidebarApplicationRef = {
    appType: SidebarApplicationType;
    appRefId: string;
};

export function getSidebarApplicationKey(ref: SidebarApplicationRef): string {
    return `${ref.appType}:${ref.appRefId}`;
}
