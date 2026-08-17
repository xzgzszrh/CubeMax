import type { XiaomiHomeServer } from "@buildingai/db/entities";

import {
    getXiaomiHomeApiHost,
    XIAOMI_HOME_HTTP_TIMEOUT_MS,
    XIAOMI_HOME_OAUTH_AUTH_URL,
    XIAOMI_HOME_OAUTH_CLIENT_ID,
} from "./xiaomi-home.constants";
import type {
    XiaomiHomeCloudDevice,
    XiaomiHomeInventory,
    XiaomiHomeOAuthToken,
    XiaomiHomeOAuthTokenWithExpiry,
    XiaomiHomeRawHome,
} from "./xiaomi-home.types";

type XiaomiHomeDevicePage = {
    list?: Array<Record<string, unknown>>;
    has_more?: boolean;
    next_start_did?: string;
};

type XiaomiHomeHomeResponse = {
    homelist?: XiaomiHomeRawHome[];
    share_home_list?: XiaomiHomeRawHome[];
    has_more?: boolean;
    max_id?: string;
};

type XiaomiHomeMoreRoomResponse = {
    info?: XiaomiHomeRawHome[];
    has_more?: boolean;
    max_id?: string;
};

async function readJsonResponse(response: Response): Promise<Record<string, any>> {
    const text = await response.text();
    try {
        const payload = JSON.parse(text) as Record<string, any>;
        return payload;
    } catch {
        return { message: text || "小米云返回了无效响应" };
    }
}

export class XiaomiHomeCloudError extends Error {
    constructor(
        message: string,
        public readonly unauthorized = false,
        public readonly status?: number,
    ) {
        super(message);
        this.name = "XiaomiHomeCloudError";
    }
}

export class XiaomiHomeCloudClient {
    private readonly apiHost: string;

    constructor(
        private readonly cloudServer: XiaomiHomeServer,
        private readonly accessToken?: string,
    ) {
        this.apiHost = getXiaomiHomeApiHost(cloudServer);
    }

    static buildAuthorizationUrl(params: {
        redirectUri: string;
        deviceId: string;
        state: string;
    }): string {
        const search = new URLSearchParams({
            redirect_uri: params.redirectUri,
            client_id: XIAOMI_HOME_OAUTH_CLIENT_ID,
            response_type: "code",
            device_id: params.deviceId,
            state: params.state,
            skip_confirm: "false",
        });
        return `${XIAOMI_HOME_OAUTH_AUTH_URL}?${search.toString()}`;
    }

    static async exchangeCode(params: {
        cloudServer: XiaomiHomeServer;
        redirectUri: string;
        code: string;
        deviceId: string;
    }): Promise<XiaomiHomeOAuthTokenWithExpiry> {
        return this.exchangeToken(params.cloudServer, {
            client_id: XIAOMI_HOME_OAUTH_CLIENT_ID,
            redirect_uri: params.redirectUri,
            code: params.code,
            device_id: params.deviceId,
        });
    }

    static async refreshToken(params: {
        cloudServer: XiaomiHomeServer;
        redirectUri: string;
        refreshToken: string;
    }): Promise<XiaomiHomeOAuthTokenWithExpiry> {
        return this.exchangeToken(params.cloudServer, {
            client_id: XIAOMI_HOME_OAUTH_CLIENT_ID,
            redirect_uri: params.redirectUri,
            refresh_token: params.refreshToken,
        });
    }

    private static async exchangeToken(
        cloudServer: XiaomiHomeServer,
        data: Record<string, string>,
    ): Promise<XiaomiHomeOAuthTokenWithExpiry> {
        const host = getXiaomiHomeApiHost(cloudServer);
        const search = new URLSearchParams({ data: JSON.stringify(data) });
        let response: Response;
        try {
            response = await fetch(`https://${host}/app/v2/ha/oauth/get_token?${search}`, {
                headers: { "content-type": "application/x-www-form-urlencoded" },
                signal: AbortSignal.timeout(XIAOMI_HOME_HTTP_TIMEOUT_MS),
            });
        } catch (error) {
            throw new XiaomiHomeCloudError(
                `连接小米 OAuth 服务失败：${error instanceof Error ? error.message : String(error)}`,
            );
        }
        const payload = await readJsonResponse(response);
        if (!response.ok || payload.code !== 0 || !payload.result) {
            throw new XiaomiHomeCloudError(
                `小米 OAuth 授权失败：${payload.message || response.statusText || response.status}`,
                response.status === 401,
                response.status,
            );
        }
        const result = payload.result as Partial<XiaomiHomeOAuthToken>;
        if (
            typeof result.access_token !== "string" ||
            typeof result.refresh_token !== "string" ||
            typeof result.expires_in !== "number"
        ) {
            throw new XiaomiHomeCloudError("小米 OAuth 返回了无效的 token");
        }
        return {
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            expires_in: result.expires_in,
            expires_ts: Date.now() + Math.max(60, result.expires_in * 0.7) * 1000,
        };
    }

    async getUserProfile(): Promise<{ uid?: string; miliaoNick?: string }> {
        this.requireToken();
        let response: Response;
        try {
            const search = new URLSearchParams({
                clientId: XIAOMI_HOME_OAUTH_CLIENT_ID,
                token: this.accessToken!,
            });
            response = await fetch(`https://open.account.xiaomi.com/user/profile?${search}`, {
                signal: AbortSignal.timeout(XIAOMI_HOME_HTTP_TIMEOUT_MS),
            });
        } catch (error) {
            throw new XiaomiHomeCloudError(
                `获取小米账号信息失败：${error instanceof Error ? error.message : String(error)}`,
            );
        }
        const payload = await readJsonResponse(response);
        if (!response.ok || payload.code !== 0 || !payload.data) {
            throw new XiaomiHomeCloudError(
                `获取小米账号信息失败：${payload.message || response.statusText || response.status}`,
                response.status === 401,
                response.status,
            );
        }
        return payload.data as { uid?: string; miliaoNick?: string };
    }

    async getInventory(): Promise<XiaomiHomeInventory> {
        const homePayload = await this.post<XiaomiHomeHomeResponse>("/app/v2/homeroom/gethome", {
            limit: 150,
            fetch_share: true,
            fetch_share_dev: true,
            plat_form: 0,
            app_ver: 9,
        });
        const sourceHomes = [
            ...(homePayload.homelist || []),
            ...(homePayload.share_home_list || []),
        ];
        if (homePayload.has_more && homePayload.max_id) {
            let maxId: string | undefined = homePayload.max_id;
            while (maxId) {
                const page = await this.post<XiaomiHomeMoreRoomResponse>(
                    "/app/v2/homeroom/get_dev_room_page",
                    { start_id: maxId, limit: 150 },
                );
                sourceHomes.push(...(page.info || []));
                maxId = page.has_more && page.max_id ? page.max_id : undefined;
            }
        }
        const homeMap = new Map<
            string,
            {
                id: string;
                name: string;
                uid: string | null;
                rooms: Map<string, { name: string; dids: Set<string> }>;
            }
        >();
        const deviceContext = new Map<
            string,
            {
                homeId: string;
                homeName: string;
                roomId: string;
                roomName: string;
                uid: string | null;
            }
        >();

        for (const home of sourceHomes) {
            const homeId = String(home.id);
            const homeName = home.name || homeId;
            const uid = home.uid === undefined ? null : String(home.uid);
            const entry = homeMap.get(homeId) || {
                id: homeId,
                name: homeName,
                uid,
                rooms: new Map<string, { name: string; dids: Set<string> }>(),
            };
            for (const did of home.dids || []) {
                deviceContext.set(String(did), {
                    homeId,
                    homeName,
                    roomId: homeId,
                    roomName: homeName,
                    uid,
                });
            }
            for (const room of home.roomlist || []) {
                const roomId = String(room.id);
                const roomName = room.name || roomId;
                const roomEntry = entry.rooms.get(roomId) || {
                    name: roomName,
                    dids: new Set<string>(),
                };
                for (const did of room.dids || []) {
                    const didString = String(did);
                    roomEntry.dids.add(didString);
                    deviceContext.set(didString, { homeId, homeName, roomId, roomName, uid });
                }
                entry.rooms.set(roomId, roomEntry);
            }
            homeMap.set(homeId, entry);
        }

        const dids = [...deviceContext.keys()];
        const rawDevices = await this.getDevices(dids);
        const devices = rawDevices.map((device) => {
            const context = deviceContext.get(device.did);
            return {
                ...device,
                homeId: context?.homeId || null,
                homeName: context?.homeName || null,
                roomId: context?.roomId || null,
                roomName: context?.roomName || null,
                uid: device.uid || context?.uid || null,
            };
        });
        return {
            uid: homePayload.homelist?.[0]?.uid ? String(homePayload.homelist[0].uid) : null,
            homes: [...homeMap.values()].map((home) => ({
                id: home.id,
                name: home.name,
                uid: home.uid,
                roomInfo: [...home.rooms.entries()].map(([id, room]) => ({
                    id,
                    name: room.name,
                    deviceCount: room.dids.size,
                })),
            })),
            devices,
        };
    }

    private async getDevices(dids: string[]): Promise<XiaomiHomeCloudDevice[]> {
        const devices: XiaomiHomeCloudDevice[] = [];
        for (let index = 0; index < dids.length; index += 150) {
            let startDid: string | undefined;
            do {
                const page = await this.post<XiaomiHomeDevicePage>(
                    "/app/v2/home/device_list_page",
                    {
                        limit: 200,
                        get_split_device: true,
                        get_third_device: true,
                        dids: dids.slice(index, index + 150),
                        ...(startDid ? { start_did: startDid } : {}),
                    },
                );
                for (const device of page.list || []) {
                    const did = typeof device.did === "string" ? device.did : "";
                    const model = typeof device.model === "string" ? device.model : "";
                    const urn = typeof device.spec_type === "string" ? device.spec_type : "";
                    const name = typeof device.name === "string" ? device.name : did;
                    if (!did || !model || !urn) continue;
                    if (did.startsWith("miwifi.")) continue;
                    devices.push({
                        did,
                        uid: typeof device.uid === "string" ? device.uid : null,
                        name,
                        urn,
                        model,
                        connectType: typeof device.pid === "number" ? device.pid : null,
                        token: typeof device.token === "string" ? device.token : null,
                        online: device.isOnline === true,
                        icon: typeof device.icon === "string" ? device.icon : null,
                        manufacturer: model.split(".")[0] || null,
                        metadata: {
                            parentId: device.parent_id,
                            rssi: device.rssi,
                            localIp: device.local_ip,
                            firmwareVersion: (device.extra as Record<string, unknown> | undefined)
                                ?.fw_version,
                            voiceControl: device.voice_ctrl,
                        },
                    });
                }
                startDid = page.has_more && page.next_start_did ? page.next_start_did : undefined;
            } while (startDid);
        }
        return devices;
    }

    async getSpec(urn: string): Promise<import("./xiaomi-home.types").XiaomiHomeSpec> {
        let response: Response;
        try {
            response = await fetch(
                `https://miot-spec.org/miot-spec-v2/instance?type=${encodeURIComponent(urn)}`,
                { signal: AbortSignal.timeout(XIAOMI_HOME_HTTP_TIMEOUT_MS) },
            );
        } catch (error) {
            throw new XiaomiHomeCloudError(
                `获取 MIoT 设备规格失败：${error instanceof Error ? error.message : String(error)}`,
            );
        }
        if (!response.ok) {
            throw new XiaomiHomeCloudError(`获取 MIoT 设备规格失败：${response.status}`);
        }
        return (await response.json()) as import("./xiaomi-home.types").XiaomiHomeSpec;
    }

    async getProperties(params: Array<{ did: string; siid: number; piid: number }>) {
        const results: Array<{
            did: string;
            siid: number;
            piid: number;
            value?: unknown;
            code?: number;
        }> = [];
        for (let index = 0; index < params.length; index += 150) {
            const payload = await this.post<
                Array<{ did: string; siid: number; piid: number; value?: unknown; code?: number }>
            >("/app/v2/miotspec/prop/get", {
                datasource: 1,
                params: params.slice(index, index + 150),
            });
            results.push(...(payload || []));
        }
        return results;
    }

    async setProperty(params: Array<{ did: string; siid: number; piid: number; value: unknown }>) {
        return this.post<Array<{ did?: string; siid?: number; piid?: number; code?: number }>>(
            "/app/v2/miotspec/prop/set",
            { params },
            15_000,
        );
    }

    async action(params: { did: string; siid: number; aiid: number; in: unknown[] }) {
        return this.post<Record<string, unknown>>(
            "/app/v2/miotspec/action",
            {
                params,
            },
            15_000,
        );
    }

    private requireToken(): void {
        if (!this.accessToken) throw new XiaomiHomeCloudError("小米账号未完成授权", true, 401);
    }

    private async post<T>(
        path: string,
        data: Record<string, unknown>,
        timeout = XIAOMI_HOME_HTTP_TIMEOUT_MS,
    ): Promise<T> {
        this.requireToken();
        let response: Response;
        try {
            response = await fetch(`https://${this.apiHost}${path}`, {
                method: "POST",
                headers: {
                    Host: this.apiHost,
                    "Content-Type": "application/json",
                    "X-Client-BizId": "haapi",
                    "X-Client-AppId": XIAOMI_HOME_OAUTH_CLIENT_ID,
                    // MIoT cloud follows the Home Assistant integration's legacy
                    // `Bearer${token}` header format (without a separating space).
                    Authorization: `Bearer${this.accessToken}`,
                },
                body: JSON.stringify(data),
                signal: AbortSignal.timeout(timeout),
            });
        } catch (error) {
            throw new XiaomiHomeCloudError(
                `连接小米云失败：${error instanceof Error ? error.message : String(error)}`,
            );
        }
        const payload = await readJsonResponse(response);
        if (response.status === 401) {
            throw new XiaomiHomeCloudError("小米授权已失效", true, response.status);
        }
        if (!response.ok || payload.code !== 0 || payload.result === undefined) {
            throw new XiaomiHomeCloudError(
                `小米云请求失败：${payload.message || response.statusText || response.status}`,
                false,
                response.status,
            );
        }
        return payload.result as T;
    }
}
