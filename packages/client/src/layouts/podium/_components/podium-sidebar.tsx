import { Button } from "@buildingai/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
} from "@buildingai/ui/components/ui/sidebar";
import { Building2, CircleUserRound, House } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";

import type { PodiumWorkspace } from "@/hooks/use-podium-workspace";

import { NavUser } from "../../console/_components/nav-user";
import { PodiumLogo } from "./podium-logo";
import { PodiumNavMain } from "./podium-nav-main";

export function PodiumSidebar({
  workspace,
  ...props
}: React.ComponentProps<typeof Sidebar> & { workspace: PodiumWorkspace }) {
  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <PodiumLogo />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <SidebarGroup className="in-data-[state=collapsed]:hidden">
          <Select
            value={workspace.organizationId || "personal"}
            onValueChange={(value) =>
              workspace.switchWorkspace(value === "personal" ? null : value)
            }
          >
            <SelectTrigger className="w-full px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workspace.hasPersonalWorkspace ? (
                <SelectItem value="personal">
                  <span className="flex items-center gap-2">
                    <CircleUserRound className="size-4" />
                    个人空间
                  </span>
                </SelectItem>
              ) : null}
              {workspace.organizations.map((organization) => (
                <SelectItem value={organization.id} key={organization.id}>
                  <span className="flex items-center gap-2">
                    <Building2 className="size-4" />
                    {organization.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SidebarGroup>

        <PodiumNavMain permissions={workspace.permissions} />

        <SidebarGroup className="mt-auto">
          <Button variant="ghost" className="justify-start" asChild>
            <Link to="/">
              <House />
              <span className="in-data-[state=collapsed]:hidden">返回首页</span>
            </Link>
          </Button>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
