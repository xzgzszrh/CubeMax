import { createHmac, timingSafeEqual } from "crypto";

export function cameraFileSigningSecret(): string {
    return process.env.CAMERA_FILE_SIGNING_SECRET || process.env.JWT_SECRET || "BuildingAI";
}

export function hmacSha256Hex(secret: string, value: string): string {
    return createHmac("sha256", secret).update(value).digest("hex");
}

export function signCameraFile(fileId: string, exp: number, secret = cameraFileSigningSecret()): string {
    return hmacSha256Hex(secret, `${fileId}.${exp}`);
}

export function verifyCameraFileSignature(
    fileId: string,
    exp: number,
    sig: string,
    secret = cameraFileSigningSecret(),
): boolean {
    if (!/^[0-9a-f]{64}$/.test(sig)) return false;
    const expected = signCameraFile(fileId, exp, secret);
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== 32 || b.length !== 32) return false;
    return timingSafeEqual(a, b);
}

export function mintCameraFileUrl(fileId: string, ttlSec: number, origin: string): {
    url: string;
    exp: number;
} {
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    const sig = signCameraFile(fileId, exp);
    const base = origin.replace(/\/$/, "");
    const prefix = (process.env.VITE_APP_WEB_API_PREFIX || "/api").replace(/\/$/, "");
    return {
        url: `${base}${prefix}/mobile/camera/files/${fileId}?exp=${exp}&sig=${sig}`,
        exp,
    };
}

export function requestOrigin(host?: string, proto?: string): string {
    const configured = process.env.APP_DOMAIN?.replace(/\/$/, "");
    if (configured) return configured;
    const protocol = proto === "https" || proto === "http" ? proto : "http";
    if (host) return `${protocol}://${host}`;
    return `http://localhost:${process.env.SERVER_PORT || 4090}`;
}
