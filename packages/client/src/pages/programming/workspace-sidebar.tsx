import type { ProgrammingProjectItem, ProgrammingRuntimeTarget } from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Separator } from "@buildingai/ui/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@buildingai/ui/components/ui/sidebar";
import { cn } from "@buildingai/ui/lib/utils";
import {
  ArrowLeft,
  Braces,
  CheckCircle2,
  Code2,
  Hammer,
  MonitorPlay,
  Pencil,
  Rocket,
  Settings,
  Wrench,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { path: "program", label: "主流程", description: "编排工程执行顺序", icon: Hammer },
  {
    path: "lua",
    label: "Lua 模块",
    description: "管理可调用的模块",
    icon: Braces,
    applicationOnly: true,
  },
  {
    path: "simulator",
    label: "仿真",
    description: "检查设备执行效果",
    icon: MonitorPlay,
    applicationOnly: true,
  },
  { path: "tools", label: "工具", description: "配置外部服务调用", icon: Wrench },
  { path: "settings", label: "设置", description: "目标设备与运行配置", icon: Settings },
  { path: "publish", label: "发布", description: "发布到设备或设置触发器", icon: Rocket },
] as const;

const RUNTIME_LABELS: Record<ProgrammingRuntimeTarget, string> = {
  local: "本地运行",
  simulator: "硬件仿真",
  device: "CubeCat 设备",
};

type ProgrammingSidebarProps = {
  project: ProgrammingProjectItem;
  onEdit: () => void;
};

export function ProgrammingSidebar({ project, onEdit }: ProgrammingSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const basePath = `/programming/${project.id}`;

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleEdit = () => {
    closeMobileSidebar();
    onEdit();
  };

  const handleNavigate = (path: string) => {
    closeMobileSidebar();
    navigate(path);
  };

  return (
    <Sidebar collapsible="icon" className="bg-sidebar rounded-r-lg border-r-0! p-2">
      <SidebarHeader
        className="group/header hover:bg-sidebar-accent rounded-lg px-2 py-3 transition-colors"
        onClick={handleEdit}
      >
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(event) => {
              event.stopPropagation();
              handleNavigate("/programming");
            }}
            aria-label="返回工程列表"
            title="返回工程列表"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 group-data-[collapsible=icon]:hidden"
            onClick={(event) => {
              event.stopPropagation();
              handleEdit();
            }}
            aria-label="编辑工程信息"
            title="编辑工程信息"
          >
            <Pencil className="size-4" />
          </Button>
        </div>

        <div className="mt-3 flex min-w-0 items-start gap-3 overflow-hidden group-data-[collapsible=icon]:hidden">
          <span className="bg-foreground text-background flex size-10 shrink-0 items-center justify-center rounded-xl shadow-xs">
            <Code2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{project.name}</span>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 px-1.5 py-0 text-[10px] font-medium",
                  project.isPublished
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "text-muted-foreground",
                )}
              >
                {project.isPublished ? "已发布" : "草稿"}
              </Badge>
              <Badge
                variant="outline"
                className="text-muted-foreground shrink-0 px-1.5 py-0 text-[10px] font-normal"
              >
                {project.projectType === "application" ? "应用" : "对话流"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-4">
              {project.description?.trim() || "还没有工程说明"}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <Separator className="my-4" />

      <SidebarContent>
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="text-muted-foreground px-2 text-[11px] font-medium tracking-wide group-data-[collapsible=icon]:sr-only">
            工程空间
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.filter(
                (item) => project.projectType === "application" || !("applicationOnly" in item),
              ).map(({ path, label, description, icon: Icon }) => {
                const isActive = location.pathname.startsWith(`${basePath}/${path}`);
                return (
                  <SidebarMenuItem key={path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={label}
                      size="lg"
                      className={cn(
                        "h-11 gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
                        isActive &&
                          "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                      )}
                    >
                      <Button
                        variant="ghost"
                        className="w-full justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                        onClick={() => handleNavigate(`${basePath}/${path}`)}
                      >
                        <Icon />
                        <span className="flex min-w-0 flex-col items-start group-data-[collapsible=icon]:hidden">
                          <span className="text-sm font-medium whitespace-nowrap">{label}</span>
                          <span className="text-muted-foreground truncate text-[10px] font-normal">
                            {description}
                          </span>
                        </span>
                      </Button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-0">
        <div className="bg-sidebar-accent/60 rounded-lg px-3 py-2.5 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-[11px] font-medium">运行目标</p>
              <p className="text-muted-foreground truncate text-[11px]">
                {RUNTIME_LABELS[project.runtimeTarget]}
              </p>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground px-2 pb-1 text-[10px] leading-4 group-data-[collapsible=icon]:hidden">
          {project.projectType === "application"
            ? "一个工程包含一个主流程和多个可复用模块"
            : "一个工程包含一个主流程和可配置的外部工具"}
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
