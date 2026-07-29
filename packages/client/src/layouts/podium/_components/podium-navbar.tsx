import { ReloadWindow } from "@buildingai/ui/components/reload-windows";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@buildingai/ui/components/ui/breadcrumb";
import { Button } from "@buildingai/ui/components/ui/button";
import { Separator } from "@buildingai/ui/components/ui/separator";
import { SidebarTrigger, useSidebar } from "@buildingai/ui/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@buildingai/ui/components/ui/tooltip";
import { RotateCcw } from "lucide-react";
import { useLocation } from "react-router-dom";

import { findPodiumNavItem } from "../_config/nav";

export function PodiumNavbar() {
  const { state } = useSidebar();
  const location = useLocation();
  const current = findPodiumNavItem(location.pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-3 px-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger className="size-fit bg-transparent p-0 hover:bg-transparent" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{state === "expanded" ? "收起侧边栏" : "展开侧边栏"}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ReloadWindow asChild>
              <Button
                className="size-fit bg-transparent p-0 hover:bg-transparent"
                variant="ghost"
                size="icon-sm"
              >
                <RotateCcw />
              </Button>
            </ReloadWindow>
          </TooltipTrigger>
          <TooltipContent>
            <p>重新加载</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-0.5 data-vertical:h-3.5" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbPage>讲台</BreadcrumbPage>
            </BreadcrumbItem>
            {current ? (
              <>
                <BreadcrumbSeparator className="hidden md:flex" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{current.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
