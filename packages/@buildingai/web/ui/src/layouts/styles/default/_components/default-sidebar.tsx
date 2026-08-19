import { useUserConfigByGroupQuery } from "@buildingai/services/shared";
import type { DecorateMenuGroup, DecorateMenuItem } from "@buildingai/services/web";
import {
  getActiveOrganizationId,
  getExtensionApplicationViews,
  normalizeSidebarApplicationRefs,
  OrganizationRole,
  SIDEBAR_PREFERENCES_GROUP,
  SIDEBAR_PREFERENCES_KEY,
  SIDEBAR_SYSTEM_APPLICATIONS,
  useConversationsQuery,
  useDecorateMenuQuery,
  useMyAppScopeQuery,
  useWebAppsDecorateItemsInfiniteQuery,
  useWorkflowListQuery,
  useWorkspaceContextQuery,
} from "@buildingai/services/web";
import { useAuthStore } from "@buildingai/stores";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@buildingai/ui/components/ui/sidebar";
import { isEnabled } from "@buildingai/utils/is";
import { ArrowUpRight, LayoutDashboard, Presentation } from "lucide-react";
import { useEffect, useMemo } from "react";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";

import { DefaultNavGroup } from "./default-group";
import { DefaultLogo } from "./default-logo";
import { DefaultNavMain, type NavItem } from "./default-nav-main";
import { DefaultNavUser } from "./default-nav-user";

/**
 * Keyboard shortcut component that registers a global shortcut and displays the key hint
 */
function KeyboardShortcut({
  keys,
  onTrigger,
  className,
}: {
  keys: { meta?: boolean; ctrl?: boolean; shift?: boolean; key: string };
  onTrigger: () => void;
  className?: string;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const metaMatch = keys.meta ? e.metaKey : true;
      const ctrlMatch = keys.ctrl ? e.ctrlKey : true;
      const shiftMatch = keys.shift ? e.shiftKey : true;
      const keyMatch = e.key.toLowerCase() === keys.key.toLowerCase();

      if (metaMatch && ctrlMatch && shiftMatch && keyMatch) {
        e.preventDefault();
        onTrigger();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keys, onTrigger]);

  const label = [keys.meta && "⌘", keys.ctrl && "⌃", keys.shift && "⇧", keys.key.toUpperCase()]
    .filter(Boolean)
    .join("");

  return <span className={className}>{label}</span>;
}

const MENU_HOME_FIXED = "menu_home_fixed";
const MENU_HISTORY_FIXED = "menu_history_fixed";
const APPLICATION_GROUP_ID = "group_default_apps";
const APPLICATION_MENU_IDS = new Set([
  "menu_datasets",
  "menu_smart-home",
  "menu_triggers",
  "menu_my_assignments_fixed",
  "menu_datasets_fixed",
  "menu_smart-home_fixed",
  "menu_my-assignments_fixed",
  "menu_triggers_fixed",
]);

/**
 * Default chat component path used to identify if home page is the chat page.
 */
const DEFAULT_CHAT_COMPONENT = "/src/pages/index.tsx";

/**
 * Convert DecorateMenuItem to NavItem format used by DefaultNavMain.
 * Handles special menu_history_fixed item by injecting conversation sub-items.
 */
function useMenuItems(
  menus: DecorateMenuItem[],
  conversationItems: { id: string; title: string; path: string }[],
  homeAction?: React.ReactNode,
): NavItem[] {
  return useMemo(() => {
    return menus
      .filter(
        (menu) =>
          !menu.isHidden &&
          !APPLICATION_MENU_IDS.has(menu.id) &&
          !menu.link.path.includes("/apps/simple-blog"),
      )
      .map((menu): NavItem => {
        if (menu.id === MENU_HISTORY_FIXED) {
          return {
            id: menu.id,
            title: menu.title,
            icon: menu.icon,
            isActive: true,
            items: conversationItems,
          };
        }

        const isMarketMenu = menu.id === "menu_app-center";
        const isMyAgentsMenu = menu.id === "menu_agent-center";

        return {
          id: menu.id,
          title: isMarketMenu ? "市场" : isMyAgentsMenu ? "我的智能体" : menu.title,
          path: isMarketMenu ? "/market" : menu.link.path,
          icon: isMarketMenu ? "store" : menu.icon,
          target: menu.link.target,
          ...(menu.id === MENU_HOME_FIXED && homeAction ? { action: homeAction } : {}),
        };
      });
  }, [menus, conversationItems, homeAction]);
}

function useSidebarApplicationGroup(
  isLoggedIn: boolean,
  workspaceContext: ReturnType<typeof useWorkspaceContextQuery>["data"],
  appScope: ReturnType<typeof useMyAppScopeQuery>["data"],
  configuredGroup?: DecorateMenuGroup,
): DecorateMenuGroup {
  const { data: sidebarConfig } = useUserConfigByGroupQuery(SIDEBAR_PREFERENCES_GROUP, {
    enabled: isLoggedIn,
  });
  const { data: extensionData } = useWebAppsDecorateItemsInfiniteQuery(
    { pageSize: 100 },
    { enabled: isLoggedIn },
  );
  const { data: workflowData } = useWorkflowListQuery(
    { page: 1, pageSize: 100, isPublished: true },
    { enabled: isLoggedIn },
  );

  return useMemo(() => {
    if (!isLoggedIn) {
      return {
        id: APPLICATION_GROUP_ID,
        title: configuredGroup?.title || "应用",
        isHidden: false,
        items: [],
      };
    }

    const activeOrganizationId = getActiveOrganizationId();
    const activeOrganization = workspaceContext?.organizations.find(
      (organization) => organization.id === activeOrganizationId,
    );
    const isStudentOnly = Boolean(
      activeOrganization &&
      activeOrganization.roles.includes(OrganizationRole.STUDENT) &&
      !activeOrganization.roles.some((role) =>
        [OrganizationRole.TEACHER, OrganizationRole.ADMIN, OrganizationRole.SCHOOL_ADMIN].some(
          (managedRole) => managedRole === role,
        ),
      ),
    );

    const available = new Map<string, DecorateMenuItem>();
    for (const system of SIDEBAR_SYSTEM_APPLICATIONS) {
      if (system.appRefId === "my-assignments" && !activeOrganization) continue;
      if (
        appScope?.restricted &&
        !appScope.systemIds.includes(system.appRefId) &&
        !(appScope.sidebar?.systemIds ?? []).includes(system.appRefId)
      ) {
        continue;
      }
      available.set(`system:${system.appRefId}`, {
        id: `menu_system_${system.appRefId}`,
        icon: system.icon,
        title: system.title,
        link: {
          label: system.title,
          path: system.path,
          type: "system",
          query: {},
          component: null,
          target: "_self",
        },
      });
    }

    for (const extension of extensionData?.pages.flatMap((page) => page.items) ?? []) {
      if (extension.identifier === "simple-blog") continue;
      const views = getExtensionApplicationViews(extension);
      if (extension.aliasShow === false || (isStudentOnly && typeof views.student !== "string"))
        continue;
      if (
        appScope?.restricted &&
        !appScope.extensionIds.includes(extension.id) &&
        !(appScope.sidebar?.extensionIds ?? []).includes(extension.id)
      ) {
        continue;
      }
      available.set(`extension:${extension.id}`, {
        id: `menu_extension_${extension.id}`,
        icon: extension.aliasIcon || extension.icon || "puzzle",
        title: extension.alias || extension.name,
        link: {
          label: extension.alias || extension.name,
          path: `/apps/${extension.identifier}${isStudentOnly && views.student ? `/${views.student}` : ""}`,
          type: "extension",
          query: {},
          component: null,
          target: "_self",
        },
      });
    }

    for (const workflow of workflowData?.items ?? []) {
      if (
        appScope?.restricted &&
        !appScope.workflowIds.includes(workflow.id) &&
        !(appScope.sidebar?.workflowIds ?? []).includes(workflow.id)
      ) {
        continue;
      }
      available.set(`workflow:${workflow.id}`, {
        id: `menu_workflow_${workflow.id}`,
        icon: "code-2",
        title: workflow.name,
        link: {
          label: workflow.name,
          path: `/apps/workflows/${workflow.id}`,
          type: "system",
          query: {},
          component: null,
          target: "_self",
        },
      });
    }

    const configured = normalizeSidebarApplicationRefs(sidebarConfig?.[SIDEBAR_PREFERENCES_KEY]);
    const defaultKeys = SIDEBAR_SYSTEM_APPLICATIONS.filter(
      (item) => item.appRefId !== "my-assignments" || Boolean(activeOrganization),
    ).map((item) => `system:${item.appRefId}`);
    const selectedKeys =
      sidebarConfig?.[SIDEBAR_PREFERENCES_KEY] === undefined
        ? defaultKeys
        : configured.map((item) => `${item.appType}:${item.appRefId}`);
    const forcedKeys = [
      ...(appScope?.sidebar?.systemIds.map((id) => `system:${id}`) ?? []),
      ...(appScope?.sidebar?.extensionIds.map((id) => `extension:${id}`) ?? []),
      ...(appScope?.sidebar?.workflowIds.map((id) => `workflow:${id}`) ?? []),
    ];
    const orderedKeys = [...selectedKeys, ...forcedKeys].filter(
      (key, index, keys) => keys.indexOf(key) === index,
    );

    return {
      id: APPLICATION_GROUP_ID,
      title: configuredGroup?.title || "应用",
      isHidden: false,
      items: orderedKeys.map((key) => available.get(key)).filter(Boolean) as DecorateMenuItem[],
    };
  }, [
    appScope,
    configuredGroup?.title,
    extensionData,
    isLoggedIn,
    sidebarConfig,
    workflowData,
    workspaceContext,
  ]);
}

export function DefaultAppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate();
  const { userInfo } = useAuthStore((state) => state.auth);
  const { isLogin } = useAuthStore((state) => state.authActions);
  const { data: menuConfig, isLoading: isMenuLoading } = useDecorateMenuQuery();
  const { data: conversationsData } = useConversationsQuery(
    { page: 1, pageSize: 6 },
    { refetchOnWindowFocus: false },
  );

  const conversationItems = useMemo(
    () =>
      conversationsData?.items?.map((conversation) => ({
        id: `conversation-${conversation.id}`,
        title: conversation.title || "新对话",
        path: `/c/${conversation.id}`,
      })) || [],
    [conversationsData],
  );

  const homeMenu = menuConfig?.menus?.find((m) => m.id === MENU_HOME_FIXED);
  const isChatHome = homeMenu?.link?.component === DEFAULT_CHAT_COMPONENT;

  const homeAction = isChatHome ? (
    <KeyboardShortcut
      keys={{ meta: true, key: "k" }}
      onTrigger={() => navigate("/")}
      className="text-muted-foreground/70 opacity-0 group-hover/link-menu-item:opacity-100"
    />
  ) : undefined;

  const navMain = useMenuItems(menuConfig?.menus ?? [], conversationItems, homeAction);

  // 老师/管理员在任一组织有教学身份时，课堂入口以底部「讲台」按钮呈现；
  // 学生和个人空间用户仍从主导航的「课堂」项进入。
  const { data: workspaceContext } = useWorkspaceContextQuery({ enabled: isLogin() });
  const { data: appScope } = useMyAppScopeQuery({ enabled: isLogin() });
  const isTeacher = useMemo(
    () =>
      (workspaceContext?.organizations ?? []).some((organization) =>
        organization.roles.some(
          (role) =>
            role === OrganizationRole.TEACHER ||
            role === OrganizationRole.ADMIN ||
            role === OrganizationRole.SCHOOL_ADMIN,
        ),
      ),
    [workspaceContext],
  );

  // 课堂只给学生看（老师从底部「讲台」进）；应用栏中的系统应用和普通应用
  // 由个人置顶设置与组织强制置顶共同决定。
  const navWithClassroom = useMemo<NavItem[]>(() => {
    if (!isLogin()) return navMain;
    const items = [...navMain];
    if (!isTeacher) {
      items.push({
        id: "menu_classroom_fixed",
        title: "课堂",
        icon: "presentation",
        path: "/classroom",
      });
    }
    return items;
  }, [navMain, isLogin, isTeacher]);

  const applicationGroup = useSidebarApplicationGroup(
    isLogin(),
    workspaceContext,
    appScope,
    menuConfig?.groups?.find((group) => group.id === APPLICATION_GROUP_ID),
  );

  const consoleLink = useMemo(() => {
    const menus = userInfo?.menus || [];

    let firstMenuPath: string | null = null;

    const findMenuPath = (items: typeof menus, parentPath = ""): string | null => {
      for (const item of items) {
        const currentPath = item.path
          ? [parentPath, item.path].filter(Boolean).join("/")
          : parentPath;

        if (item.type === 2 && item.path && item.path !== "#") {
          const fullPath = `/console/${currentPath}`;
          if (fullPath === "/console/dashboard") return fullPath;
          if (!firstMenuPath) firstMenuPath = fullPath;
        }

        if (item.children?.length) {
          const result = findMenuPath(item.children, currentPath);
          if (result) return result;
        }
      }
      return null;
    };

    return findMenuPath(menus) || firstMenuPath || "/console/dashboard";
  }, [userInfo?.menus]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex flex-row items-center">
        <DefaultLogo />
      </SidebarHeader>
      <SidebarContent>
        <DefaultNavMain items={navWithClassroom} isLoading={isMenuLoading} />
        {applicationGroup.items.length > 0 && <DefaultNavGroup group={applicationGroup} />}
        {(menuConfig?.groups ?? [])
          .filter((group) => !group.isHidden && group.id !== APPLICATION_GROUP_ID)
          .map((group) => {
            const items = group.items.filter(
              (item) => !item.link.path.includes("/apps/simple-blog"),
            );
            if (!items.length) return null;
            return <DefaultNavGroup key={group.id} group={{ ...group, items }} />;
          })}
      </SidebarContent>
      <SidebarFooter className="in-data-[state=collapsed]:overflow-hidden">
        <SidebarMenu>
          {isTeacher && (
            <SidebarMenuItem>
              <SidebarMenuButton className="h-9" tooltip="讲台" asChild>
                <Link to="/podium/members">
                  <Presentation />
                  <span className="whitespace-nowrap">讲台</span>
                  <SidebarMenuAction asChild>
                    <div>
                      <ArrowUpRight />
                      <span className="sr-only">Toggle</span>
                    </div>
                  </SidebarMenuAction>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isEnabled(userInfo?.permissions) && (
            <SidebarMenuItem>
              <SidebarMenuButton className="h-9" tooltip="管理员工作台" asChild>
                <Link to={consoleLink}>
                  <LayoutDashboard />
                  <span className="whitespace-nowrap">管理员工作台</span>
                  <SidebarMenuAction asChild>
                    <div>
                      <ArrowUpRight />
                      <span className="sr-only">Toggle</span>
                    </div>
                  </SidebarMenuAction>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        <DefaultNavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
