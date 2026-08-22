import { HttpErrorFactory } from "@buildingai/errors";
import type { VisionExecutorInput } from "@flowgram.ai/runtime-js";
import { Injectable } from "@nestjs/common";

import { WorkflowPhoneCameraExecutorService } from "./workflow-phone-camera-executor.service";

function asText(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === undefined || value === null) return "";
    return String(value);
}

@Injectable()
export class WorkflowVisionExecutorService {
    constructor(private readonly phoneCameraExecutorService: WorkflowPhoneCameraExecutorService) {}

    async execute(input: VisionExecutorInput): Promise<Record<string, unknown>> {
        if (!input.userId) throw HttpErrorFactory.unauthorized("视觉节点需要登录后执行");
        const captured = await this.phoneCameraExecutorService.execute({
            userId: input.userId,
            runtimeContext: input.runtimeContext,
            node: {
                id: input.node.id,
                type: input.node.type,
                data: {
                    ...input.node.data,
                    deviceBinding: input.node.data?.deviceBinding || "triggering_device",
                    installationId: input.node.data?.installationId || "",
                    facingDefault: input.node.data?.facingDefault || "back",
                    allowSwitchFacing: input.node.data?.allowSwitchFacing !== false,
                    resolution: input.node.data?.resolution || "1080p",
                    timeoutMs: input.node.data?.timeoutMs || 30_000,
                    openCameraOn: input.node.data?.openCameraOn || "workflow_start",
                },
            },
            inputs: input.inputs,
        });
        return {
            success: captured.success !== false,
            imageUrl: asText(captured.imageUrl),
            analysisResult: "",
            detectedObjects: [],
            fileId: captured.fileId,
            captureId: captured.captureId,
        };
    }
}
