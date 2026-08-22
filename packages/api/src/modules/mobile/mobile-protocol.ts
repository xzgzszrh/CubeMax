export const MOBILE_WS_MAX_MESSAGE_BYTES = 65_536;
export const MOBILE_HELLO_TIMEOUT_MS = 10_000;
export const MOBILE_HEARTBEAT_INTERVAL_MS = 25_000;
export const MOBILE_CAPTURE_ACK_TIMEOUT_MS = 5_000;
export const MOBILE_CAPTURE_MAX_RETRIES = 3;
export const PRODUCT_CONSENT_TITLE = "是否授权 CubeCat 使用你的摄像头";

export const CLOSE_HELLO_TIMEOUT = 4401;
export const CLOSE_REPLACED = 4402;
export const CLOSE_UNAUTHORIZED = 4403;
export const CLOSE_BINARY = 1003;

export const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const RESERVED_STREAM_TYPES = new Set([
    "camera.stream.start",
    "camera.stream.ready",
    "camera.stream.stop",
    "camera.stream.stopped",
    "camera.webrtc.offer",
]);

export const KNOWN_CLIENT_TYPES = new Set([
    "hello",
    "device.status",
    "camera.session.ready",
    "camera.session.rejected",
    "camera.session.cancel",
    "camera.session.state",
    "camera.capture.accepted",
    "camera.capture.result",
    "error",
]);

export type MobileEnvelope = {
    v: 1;
    type: string;
    id: string;
    ts: string;
    reply_to?: string;
    data: Record<string, unknown>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringField(value: Record<string, unknown>, key: string): string | undefined {
    return typeof value[key] === "string" ? value[key] : undefined;
}

export function numberField(value: Record<string, unknown>, key: string): number | undefined {
    return typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] : undefined;
}

export function parseEnvelope(raw: unknown): MobileEnvelope | null {
    if (
        !isRecord(raw) ||
        raw.v !== 1 ||
        typeof raw.type !== "string" ||
        typeof raw.id !== "string" ||
        typeof raw.ts !== "string" ||
        !isRecord(raw.data)
    ) {
        return null;
    }
    const envelope: MobileEnvelope = {
        v: 1,
        type: raw.type,
        id: raw.id,
        ts: raw.ts,
        data: raw.data,
    };
    if (typeof raw.reply_to === "string") envelope.reply_to = raw.reply_to;
    return envelope;
}

export function mobileWebsocketPath(): string {
    const prefix = (process.env.VITE_APP_WEB_API_PREFIX || "/api").replace(/\/$/, "");
    return `${prefix}/mobile-ws/v1`;
}

export function errorCodeForUnknownType(type: string): "UNSUPPORTED_CAPABILITY" | "UNSUPPORTED_MESSAGE" {
    if (RESERVED_STREAM_TYPES.has(type) || type.startsWith("camera.stream.") || type.startsWith("camera.webrtc.")) {
        return "UNSUPPORTED_CAPABILITY";
    }
    return "UNSUPPORTED_MESSAGE";
}
