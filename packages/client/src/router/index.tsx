import { useWorkflowDetailQuery } from "@buildingai/services/web";
import AuthGuard from "@buildingai/ui/components/auth/auth-guard";
import GlobalError from "@buildingai/ui/components/exception/global-error";
import NotFoundPage from "@buildingai/ui/components/exception/not-found-page";
import MainLayout from "@buildingai/ui/layouts/main/index";
import DefaultLayout from "@buildingai/ui/layouts/styles/default/index";
import { createBrowserRouter, Navigate, useParams } from "react-router-dom";

import AgentsIndexPage from "@/pages/agents";
import AgentChatPage from "@/pages/agents/detail/chat";
import AgentConfigurationPage from "@/pages/agents/detail/configuration";
import AgentLogsPage from "@/pages/agents/detail/logs";
import AgentMonitoringPage from "@/pages/agents/detail/monitoring";
import AgentPublishPage from "@/pages/agents/detail/publish";
import PublishChatPage from "@/pages/agents/site-chat";
import AppsIndexPage from "@/pages/apps";
import WorkflowApplicationPage from "@/pages/apps/workflow";
import DatasetsIndexPage from "@/pages/datasets";
import DatasetsLayout from "@/pages/datasets/_layouts";
import DatasetsDetailPage from "@/pages/datasets/detail";
import InstallPage from "@/pages/install";
import LuaModulesPage from "@/pages/lua";
import ProgrammingProjectsPage from "@/pages/programming";
import ProgrammingWorkspaceLayout from "@/pages/programming/layout";
import ProgrammingCanvasPage from "@/pages/programming/program";
import ProgrammingToolsPage from "@/pages/programming/tools";
import ProjectSettingsPage from "@/pages/programming/settings";
import ProjectPublishPage from "@/pages/programming/publish";
import SimulatorPage from "@/pages/simulator";
import SmartHomePage from "@/pages/smart-home";
import TriggersPage from "@/pages/triggers";

import ConsoleLayout from "../layouts/console";
import PodiumLayout from "../layouts/podium";
import DynamicHomePage from "../pages";
import AppIframePage from "../pages/apps/[identifier]";
import ChatPage from "../pages/chat";
import ClassroomPage from "../pages/classroom";
import ClassroomDisplayPage from "../pages/classroom-display";
import { LoginPage } from "../pages/login";
import { OAuthCallbackPage } from "../pages/login/oauth-callback";
import MarketPage from "../pages/market";
import MyAssignmentsPage from "../pages/my-assignments";
import AlipayReturnPage from "../pages/payment/alipay-return";

function LegacyWorkflowRedirect() {
  const { id } = useParams<{ id: string }>();
  const workflowQuery = useWorkflowDetailQuery(id);
  if (!id) return <Navigate to="/programming" replace />;
  if (workflowQuery.isLoading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        正在打开工程
      </div>
    );
  }
  const projectId = workflowQuery.data?.projectId ?? id;
  return <Navigate to={`/programming/${projectId}/program`} replace />;
}

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    errorElement: <GlobalError />,
    children: [
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/login/oauth-callback",
        element: <OAuthCallbackPage />,
      },
      {
        path: "/install",
        element: <InstallPage />,
      },
      {
        path: "/payment/alipay-return",
        element: <AlipayReturnPage />,
      },
      {
        path: "/classroom-display/:publicId",
        element: <ClassroomDisplayPage />,
      },
      {
        /**
         * 课堂大屏：把某个应用的大屏视图投到教室屏幕上。
         *
         * 刻意放在 DefaultLayout 之外 —— 大屏上不该出现侧边栏和账号菜单。
         * 仍然要求登录（老师用自己的账号）：同浏览器开新标签页会直接沿用
         * 已有登录态；在另一台大屏设备上登录时走 SCREEN 终端，不会影响老师
         * 电脑上的控制台会话，详见 login-form 里 terminal 的说明。
         */
        path: "/board/:identifier/*",
        element: (
          <AuthGuard>
            <AppIframePage basePath="/board" mode="board" />
          </AuthGuard>
        ),
      },
      {
        path: "/agents/:id/configuration",
        element: <AgentConfigurationPage />,
      },
      {
        path: "/agents/:id/publish",
        element: <AgentPublishPage />,
      },
      {
        path: "/agents/:id/logs",
        element: <AgentLogsPage />,
      },
      {
        path: "/agents/:id/monitoring",
        element: <AgentMonitoringPage />,
      },
      {
        path: "/agents/:id/chat",
        element: <AgentChatPage />,
      },
      {
        path: "/agents/:id/c/:uuid",
        element: <AgentChatPage />,
      },
      {
        path: "/agents/:agentId/:accessToken/c/:conversationId",
        element: <PublishChatPage />,
      },
      {
        path: "/agents/:agentId/:accessToken",
        element: <PublishChatPage />,
      },
      {
        path: "/programming/:projectId",
        element: (
          <AuthGuard>
            <ProgrammingWorkspaceLayout />
          </AuthGuard>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="program" replace />,
          },
          {
            path: "program",
            element: <ProgrammingCanvasPage />,
          },
          {
            path: "lua",
            element: <LuaModulesPage />,
          },
          {
            path: "simulator",
            element: <SimulatorPage />,
          },
          {
            path: "tools",
            element: <ProgrammingToolsPage />,
          },
          {
            path: "settings",
            element: <ProjectSettingsPage />,
          },
          {
            path: "publish",
            element: <ProjectPublishPage />,
          },
        ],
      },
      {
        element: <DefaultLayout />,
        errorElement: (
          <DefaultLayout>
            <GlobalError />
          </DefaultLayout>
        ),
        children: [
          {
            element: <DynamicHomePage />,
            children: [
              {
                index: true,
                element: <ChatPage />,
              },
              {
                path: "/c/:id",
                element: <ChatPage />,
              },
            ],
          },
          {
            path: "/chat",
            element: <ChatPage />,
          },
          {
            path: "/chat/:id",
            element: <ChatPage />,
          },
          {
            path: "/classroom",
            element: (
              <AuthGuard>
                <ClassroomPage />
              </AuthGuard>
            ),
          },
          {
            path: "/my-assignments",
            element: (
              <AuthGuard>
                <MyAssignmentsPage />
              </AuthGuard>
            ),
          },
          {
            path: "/market",
            element: <MarketPage />,
          },
          {
            path: "/apps",
            element: <AppsIndexPage />,
          },
          {
            path: "/apps/workflows/:workflowId",
            element: (
              <AuthGuard>
                <WorkflowApplicationPage />
              </AuthGuard>
            ),
          },
          {
            path: "/apps/:identifier/*",
            element: (
              <AuthGuard>
                <AppIframePage />
              </AuthGuard>
            ),
          },
          {
            path: "/agents",
            element: <AgentsIndexPage />,
          },
          {
            path: "/datasets",
            element: <DatasetsLayout />,
            children: [
              {
                index: true,
                element: <DatasetsIndexPage />,
              },

              {
                path: "/datasets/:id",
                element: (
                  <AuthGuard>
                    <DatasetsDetailPage />
                  </AuthGuard>
                ),
              },
            ],
          },
          {
            path: "/agents/workspace",
            element: <Navigate to="/agents" replace />,
          },
          {
            path: "/programming",
            element: (
              <AuthGuard>
                <ProgrammingProjectsPage />
              </AuthGuard>
            ),
          },
          {
            path: "/smart-home",
            element: (
              <AuthGuard>
                <SmartHomePage />
              </AuthGuard>
            ),
          },
          {
            path: "/triggers",
            element: (
              <AuthGuard>
                <TriggersPage />
              </AuthGuard>
            ),
          },
          // Keep old bookmarks usable while the product vocabulary moves to 编程。
          {
            path: "/workflows",
            element: <Navigate to="/programming" replace />,
          },
          {
            path: "/lua",
            element: <Navigate to="/programming" replace />,
          },
          {
            path: "/simulator",
            element: <Navigate to="/programming" replace />,
          },
          {
            path: "/workflows/:id",
            element: (
              <AuthGuard>
                <LegacyWorkflowRedirect />
              </AuthGuard>
            ),
          },
          {
            path: "*",
            element: <NotFoundPage />,
          },
        ],
      },

      {
        element: <AuthGuard />,
        children: [
          {
            path: "/console/*",
            element: <ConsoleLayout />,
            errorElement: (
              <ConsoleLayout>
                <GlobalError />
              </ConsoleLayout>
            ),
          },
          {
            path: "/podium/*",
            element: <PodiumLayout />,
            errorElement: (
              <PodiumLayout>
                <GlobalError />
              </PodiumLayout>
            ),
          },
        ],
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
