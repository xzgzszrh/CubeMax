export type PhoneCameraNodeConfig = {
    id: string;
    data: Record<string, unknown>;
    inLoop: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function walkNodes(nodes: unknown, inLoop: boolean, acc: PhoneCameraNodeConfig[]): void {
    if (!Array.isArray(nodes)) return;
    for (const item of nodes) {
        if (!isRecord(item)) continue;
        const id = typeof item.id === "string" ? item.id : "";
        const type = typeof item.type === "string" ? item.type : "";
        const data = isRecord(item.data) ? item.data : {};
        if ((type === "phone_camera" || type === "vision") && id) {
            acc.push({ id, data, inLoop });
        }
        if (item.blocks) {
            const nested = isRecord(item.blocks) ? item.blocks.nodes : item.blocks;
            walkNodes(nested, inLoop || type === "loop", acc);
        }
    }
}

export function collectPhoneCameraNodes(schema: Record<string, unknown>): PhoneCameraNodeConfig[] {
    const acc: PhoneCameraNodeConfig[] = [];
    walkNodes(schema.nodes, false, acc);
    return acc;
}

export function schemaHasPhoneCamera(schema: Record<string, unknown>): boolean {
    return collectPhoneCameraNodes(schema).length > 0;
}

export function schemaHasOpenCameraOnWorkflowStart(schema: Record<string, unknown>): boolean {
    const nodes = collectPhoneCameraNodes(schema);
    return nodes.some((node) => node.data.openCameraOn !== "node_enter");
}

export function assertNoPhoneCameraInsideLoop(schema: Record<string, unknown>): void {
    const nested = collectPhoneCameraNodes(schema).filter((node) => node.inLoop);
    if (nested.length > 0) {
        throw new Error("摄像头节点不能放在循环节点内");
    }
}

export function maxClock(
    schema: Record<string, unknown>,
    field: "consentTimeoutMs" | "previewMaxMs",
    fallback: number,
): number {
    const nodes = collectPhoneCameraNodes(schema);
    let max = fallback;
    for (const node of nodes) {
        const value = Number(node.data[field]);
        if (Number.isFinite(value)) max = Math.max(max, value);
    }
    return max;
}

export function resolutionToEdge(resolution: unknown): number {
    if (resolution === "720p") return 1280;
    if (resolution === "native") return 4096;
    return 1920;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
