import type { RequestConfig } from "@buildingai/http";
import type { QueryOptionsUtil } from "@buildingai/web-types";
import { useQuery } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { Extension } from "../console/extension";

export type ExtensionApplicationViews = {
    teacher?: string;
    student?: string;
    board?: string;
};

export function getExtensionApplicationViews(extension?: Pick<Extension, "config"> | null) {
    const views = extension?.config?.applicationViews;
    if (!views || typeof views !== "object") return {} as ExtensionApplicationViews;

    return Object.fromEntries(
        Object.entries(views)
            .filter(
                ([key, value]) =>
                    ["teacher", "student", "board"].includes(key) && typeof value === "string",
            )
            .map(([key, value]) => [key, (value as string).trim().replace(/^\/+|\/+$/g, "")]),
    ) as ExtensionApplicationViews;
}

export function fetchWebExtensionDetail(identifier: string, config?: RequestConfig) {
    return apiHttpClient.get<Extension>(`/extension/detail/${identifier}`, config);
}

/**
 * Get public extension detail by identifier.
 */
export function useWebExtensionDetailQuery(
    identifier: string,
    options?: QueryOptionsUtil<Extension>,
) {
    return useQuery<Extension>({
        queryKey: ["web", "extension", "detail", identifier],
        queryFn: () => fetchWebExtensionDetail(identifier),
        enabled: !!identifier && options?.enabled !== false,
        ...options,
    });
}
