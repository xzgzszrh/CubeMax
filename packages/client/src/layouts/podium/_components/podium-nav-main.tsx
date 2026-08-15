import type { OrganizationPermissionType } from "@buildingai/services/web";
import { LucideIcon } from "@buildingai/ui/components/lucide-icon";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@buildingai/ui/components/ui/sidebar";
import { Link, useLocation } from "react-router-dom";

import { filterPodiumNav, PODIUM_BASE_PATH } from "../_config/nav";

export function PodiumNavMain({ permissions }: { permissions: OrganizationPermissionType[] }) {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const groups = filterPodiumNav(permissions);

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          {state === "expanded" && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarMenu>
            {group.items.map((item) => {
              const fullPath = `${PODIUM_BASE_PATH}/${item.path}`;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.name}
                    isActive={location.pathname === fullPath}
                  >
                    <Link to={fullPath} onClick={() => isMobile && setOpenMobile(false)}>
                      <LucideIcon name={item.icon} />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
