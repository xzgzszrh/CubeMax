import { useConfigStore } from "@buildingai/stores";
import SvgIcons from "@buildingai/ui/components/svg-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@buildingai/ui/components/ui/sidebar";
import { getDisplayAppInitial, getDisplayAppName } from "@buildingai/ui/lib/brand";
import { Link } from "react-router-dom";

export function ConsoleLogo() {
  const { websiteConfig } = useConfigStore((state) => state.config);
  const appName = getDisplayAppName(websiteConfig?.webinfo.name);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <Link to="/">
            <>
              {websiteConfig?.webinfo.logo ? (
                <Avatar className="h-8 rounded-md after:hidden">
                  <AvatarImage
                    className="rounded-md"
                    src={websiteConfig?.webinfo.logo}
                    alt={appName}
                  />
                  <AvatarFallback className="rounded-md">
                    {getDisplayAppInitial(websiteConfig?.webinfo.name)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <SvgIcons.buildingai className="size-8!" />
              )}
              <div className="flex flex-1 flex-col justify-center text-left text-sm">
                <span className="truncate font-medium">{appName}</span>
                <span className="flex items-center gap-1 truncate text-xs">
                  管理员工作台 ·{" "}
                  <span className="text-muted-foreground">
                    v{websiteConfig?.webinfo.version || "26.0.0"}
                  </span>
                  <Badge variant="outline">社区版</Badge>
                </span>
              </div>
            </>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
