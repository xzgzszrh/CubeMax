export function isMobileCameraEnabled(): boolean {
    return process.env.MOBILE_CAMERA_ENABLED === "true";
}
