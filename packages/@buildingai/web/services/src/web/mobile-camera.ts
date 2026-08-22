import type { QueryOptionsUtil } from "@buildingai/web-types";
import { useQuery } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

export type MobileCameraConfig = {
  cameraEnabled: boolean;
};

export type MobileInstallationItem = {
  installation_id: string;
  platform: string;
  device_model?: string | null;
  app_version?: string | null;
  online: boolean;
  capabilities: string[];
  last_seen_at?: string | null;
};

export function getMobileCameraConfig(): Promise<MobileCameraConfig> {
  return apiHttpClient.get("/mobile/config");
}

export function useMobileCameraConfigQuery(options?: QueryOptionsUtil<MobileCameraConfig>) {
  return useQuery({
    queryKey: ["mobile-camera", "config"],
    queryFn: getMobileCameraConfig,
    staleTime: 30_000,
    ...options,
  });
}

export function listMobileInstallations(): Promise<{ items: MobileInstallationItem[] }> {
  return apiHttpClient.get("/mobile/installations");
}

export function useMobileInstallationsQuery(
  options?: QueryOptionsUtil<{ items: MobileInstallationItem[] }>,
) {
  return useQuery({
    queryKey: ["mobile-camera", "installations"],
    queryFn: listMobileInstallations,
    refetchInterval: 10_000,
    ...options,
  });
}
