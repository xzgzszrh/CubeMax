import type { QueryOptionsUtil } from "@buildingai/web-types";
import { useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

export interface ConsoleEsp32Device {
    id: string;
    deviceId: string;
    displayName: string;
    online: boolean;
    firmwareVersion?: string | null;
    bootId?: string | null;
    capabilities: string[];
    limits?: Record<string, number> | null;
    runtime?: Record<string, unknown> | null;
    lastSeenAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export function useConsoleEsp32DevicesQuery(
    options?: QueryOptionsUtil<ConsoleEsp32Device[]>,
) {
    return useQuery({
        queryKey: ["console", "esp32-devices"],
        queryFn: () => consoleHttpClient.get<ConsoleEsp32Device[]>("/esp32-devices"),
        refetchInterval: 5000,
        ...options,
    });
}
