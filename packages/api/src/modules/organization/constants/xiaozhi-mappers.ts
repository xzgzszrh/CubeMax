/**
 * Pure translations between the upstream xiaozhi.me payload shapes and the
 * shapes this API returns. Kept free of repositories so the field-level quirks
 * (0/1 flags, snake_case, nullable summaries) stay unit testable.
 */

export type UpstreamDevicePayload = {
    id: number;
    agent_id?: number;
    mac_address?: string | null;
    client_id?: string | null;
    device_name?: string | null;
    alias?: string | null;
    board_name?: string | null;
    app_version?: string | null;
    serial_number?: string | null;
    auto_update?: number | boolean | string | null;
    online?: boolean | number | null;
    is_auth?: boolean | number | null;
    last_connected_at?: string | null;
};

export type UpstreamChatPayload = {
    id: number;
    created_at?: string | null;
    device_id?: number | null;
    msg_count?: number | null;
    model?: string | null;
    token_count?: number | null;
    duration?: number | null;
    chat_summary?: { title?: string | null; summary?: string | null } | null;
};

export type UpstreamChatMessagePayload = {
    id: number;
    chat_id?: number;
    role?: string | null;
    content?: string | null;
    created_at?: string | null;
    name?: string | null;
    model?: string | null;
    url?: string | null;
};

/** Upstream sends 1/0, true/false and "1"/"0" for the same flag. */
function toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === "1";
}

export function mapUpstreamDevice(device: UpstreamDevicePayload, agentId: string) {
    return {
        id: device.id,
        agentId,
        macAddress: device.mac_address || "",
        alias: device.alias || device.device_name || "",
        boardName: device.board_name || "",
        appVersion: device.app_version || "",
        serialNumber: device.serial_number || "",
        autoUpdate: toBoolean(device.auto_update),
        online: toBoolean(device.online),
        authorized: toBoolean(device.is_auth),
        lastConnectedAt: device.last_connected_at || null,
    };
}

export type MappedDevice = ReturnType<typeof mapUpstreamDevice>;

export function mapUpstreamChat(chat: UpstreamChatPayload, agentId: string, agentName: string) {
    return {
        id: chat.id,
        agentId,
        agentName,
        createdAt: chat.created_at || null,
        deviceId: chat.device_id || null,
        messageCount: chat.msg_count || 0,
        model: chat.model || "",
        tokenCount: chat.token_count || 0,
        duration: chat.duration || 0,
        title: chat.chat_summary?.title || "未命名对话",
        summary: chat.chat_summary?.summary || "",
    };
}

export function mapUpstreamChatMessage(message: UpstreamChatMessagePayload, chatId: number) {
    return {
        id: message.id,
        chatId: message.chat_id || chatId,
        role: message.role || "assistant",
        content: message.content || "",
        createdAt: message.created_at || null,
        name: message.name || "",
        model: message.model || "",
        url: message.url || "",
    };
}

/**
 * Derive the device counters the agent list renders. Returns the newest
 * connection timestamp seen upstream, or null when no device ever connected.
 */
export function summarizeDevices(devices: MappedDevice[]) {
    const timestamps = devices
        .map((device) => (device.lastConnectedAt ? Date.parse(device.lastConnectedAt) : Number.NaN))
        .filter((value) => !Number.isNaN(value));

    return {
        deviceCount: devices.length,
        onlineDeviceCount: devices.filter((device) => device.online).length,
        lastConnectedAt: timestamps.length ? new Date(Math.max(...timestamps)) : null,
    };
}
