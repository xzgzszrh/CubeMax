import { WEB_HOME_PATH } from "@buildingai/services/shared";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { SidebarInset, SidebarProvider } from "@buildingai/ui/components/ui/sidebar";
import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo } from "react";
import type { RouteObject } from "react-router-dom";
import { Navigate, useRoutes } from "react-router-dom";

import { usePodiumWorkspace } from "@/hooks/use-podium-workspace";
import PodiumActivitiesPage from "@/pages/podium/activities";
import PodiumAppsPage from "@/pages/podium/apps";
import PodiumAssignmentsPage from "@/pages/podium/assignments";
import PodiumCommandsPage from "@/pages/podium/commands";
import PodiumDevicesPage from "@/pages/podium/devices";
import PodiumMembersPage from "@/pages/podium/members";
import PodiumQuotaPage from "@/pages/podium/quota";
import PodiumScenesPage from "@/pages/podium/scenes";

import { PodiumNavbar } from "./_components/podium-navbar";
import { PodiumSidebar } from "./_components/podium-sidebar";
import { filterPodiumNav, PODIUM_BASE_PATH } from "./_config/nav";

const PAGE_BY_PATH: Record<string, RouteObject["element"]> = {
  members: <PodiumMembersPage />,
  apps: <PodiumAppsPage />,
  assignments: <PodiumAssignmentsPage />,
  quota: <PodiumQuotaPage />,
  devices: <PodiumDevicesPage />,
  scenes: <PodiumScenesPage />,
  commands: <PodiumCommandsPage />,
  activities: <PodiumActivitiesPage />,
};

/**
 * 讲台是老师视角的多页区域，导航项按组织权限过滤，
 * 因此路由表也只注册当前身份能访问的页面，避免直接输网址绕过权限。
 */
function PodiumRoutes({ allowedPaths }: { allowedPaths: string[] }) {
  const routes = useMemo<RouteObject[]>(() => {
    const first = allowedPaths[0];
    return [
      ...allowedPaths.map((path) => ({ path, element: PAGE_BY_PATH[path] })),
      {
        path: "*",
        element: first ? <Navigate to={`${PODIUM_BASE_PATH}/${first}`} replace /> : null,
      },
    ];
  }, [allowedPaths]);

  return useRoutes(routes);
}

export default function PodiumLayout({ children }: { children?: React.ReactNode }) {
  const workspace = usePodiumWorkspace();

  const allowedPaths = useMemo(
    () => filterPodiumNav(workspace.permissions).flatMap((group) => group.items.map((i) => i.path)),
    [workspace.permissions],
  );

  // 老师在个人空间点「讲台」时自动切到第一个有教学权限的班级，而不是直接弹回首页。
  const teachingOrganization = useMemo(
    () =>
      workspace.organizations.find(
        (organization) => filterPodiumNav(organization.permissions).length > 0,
      ),
    [workspace.organizations],
  );

  useEffect(() => {
    if (workspace.isLoading || allowedPaths.length) return;
    if (teachingOrganization && teachingOrganization.id !== workspace.organizationId) {
      workspace.switchWorkspace(teachingOrganization.id);
    }
  }, [allowedPaths.length, teachingOrganization, workspace]);

  if (workspace.isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    );
  }

  // 学生等没有任何教学权限的账号（且没有可切换的班级）不该进讲台。
  if (!allowedPaths.length) {
    if (teachingOrganization) {
      return (
        <div className="flex h-dvh items-center justify-center">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      );
    }
    return <Navigate to={WEB_HOME_PATH} replace />;
  }

  return (
    <SidebarProvider storageKey="layout-podium-sidebar" className="bd-console-layout h-dvh">
      <PodiumSidebar workspace={workspace} />
      <SidebarInset className="flex h-full flex-col overflow-x-hidden md:h-[calc(100%-1rem)] md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
        <PodiumNavbar />
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" viewportClassName="[&>div]:block!">
            {children ? children : <PodiumRoutes allowedPaths={allowedPaths} />}
          </ScrollArea>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
