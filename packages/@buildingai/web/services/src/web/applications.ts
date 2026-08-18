import {
    getSidebarApplicationKey,
    SIDEBAR_SYSTEM_APPLICATIONS,
    type SidebarApplicationRef,
} from "@buildingai/constants/shared/sidebar-application.constant";

export { getSidebarApplicationKey, SIDEBAR_SYSTEM_APPLICATIONS };
export type { SidebarApplicationRef, SidebarApplicationType } from "@buildingai/constants";

export const SIDEBAR_PREFERENCES_GROUP = "sidebar";
export const SIDEBAR_PREFERENCES_KEY = "pinned-applications";

/**
 * User configuration is intentionally treated as untrusted input. Invalid
 * references are ignored by the sidebar and never become navigation links.
 */
export function normalizeSidebarApplicationRefs(value: unknown): SidebarApplicationRef[] {
    if (!Array.isArray(value)) return [];

    const seen = new Set<string>();
    const result: SidebarApplicationRef[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const appType = (item as { appType?: unknown }).appType;
        const appRefId = (item as { appRefId?: unknown }).appRefId;
        if (
            !["system", "extension", "workflow"].includes(String(appType)) ||
            typeof appRefId !== "string" ||
            appRefId.length === 0 ||
            appRefId.length > 120
        ) {
            continue;
        }
        const ref = { appType: appType as SidebarApplicationRef["appType"], appRefId };
        const key = getSidebarApplicationKey(ref);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(ref);
    }
    return result;
}

export function sidebarApplicationRefKey(
    appType: SidebarApplicationRef["appType"],
    appRefId: string,
) {
    return getSidebarApplicationKey({ appType, appRefId });
}
