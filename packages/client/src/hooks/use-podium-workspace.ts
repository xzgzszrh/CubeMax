import {
  getActiveOrganizationId,
  type OrganizationPermissionType,
  type OrganizationWorkspace,
  setActiveOrganizationId,
  useWorkspaceContextQuery,
  WORKSPACE_CHANGED_EVENT,
} from "@buildingai/services/web";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export type PodiumWorkspace = {
  isLoading: boolean;
  /** 当前激活的组织，个人空间时为 null。 */
  organization: OrganizationWorkspace | null;
  organizationId: string | null;
  organizations: OrganizationWorkspace[];
  hasPersonalWorkspace: boolean;
  permissions: OrganizationPermissionType[];
  can: (permission: OrganizationPermissionType) => boolean;
  switchWorkspace: (organizationId: string | null) => void;
};

/**
 * 讲台页面共享的工作空间上下文。
 *
 * 与设置弹窗里的切换逻辑保持一致：切换组织时清掉方糖猫/课堂缓存，
 * 并通过 `WORKSPACE_CHANGED_EVENT` 让其它位置同步。
 */
export function usePodiumWorkspace(): PodiumWorkspace {
  const queryClient = useQueryClient();
  const { data: context, isLoading } = useWorkspaceContextQuery();
  const [organizationId, setOrganizationId] = useState<string | null>(() =>
    getActiveOrganizationId(),
  );

  useEffect(() => {
    const handler = () => setOrganizationId(getActiveOrganizationId());
    window.addEventListener(WORKSPACE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_CHANGED_EVENT, handler);
  }, []);

  // 本地记录的组织可能已被移除，回落到第一个可用工作空间。
  useEffect(() => {
    if (!context) return;
    const valid = context.organizations.some((item) => item.id === organizationId);
    if (valid || (organizationId === null && context.personalWorkspace)) return;
    const fallback = context.personalWorkspace ? null : context.organizations[0]?.id || null;
    setOrganizationId(fallback);
    setActiveOrganizationId(fallback);
  }, [context, organizationId]);

  const switchWorkspace = useCallback(
    (next: string | null) => {
      setActiveOrganizationId(next);
      setOrganizationId(next);
      queryClient.removeQueries({ queryKey: ["xiaozhi"] });
      queryClient.removeQueries({ queryKey: ["classroom"] });
      queryClient.invalidateQueries({ queryKey: ["user", "info"] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success(next ? "已切换组织" : "已切换个人空间");
    },
    [queryClient],
  );

  const organization = context?.organizations.find((item) => item.id === organizationId) ?? null;
  const permissions = organization?.permissions ?? [];

  return {
    isLoading,
    organization,
    organizationId,
    organizations: context?.organizations ?? [],
    hasPersonalWorkspace: Boolean(context?.personalWorkspace),
    permissions,
    can: (permission) => permissions.includes(permission),
    switchWorkspace,
  };
}
