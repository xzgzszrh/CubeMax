import { HttpErrorFactory } from "@buildingai/errors";
import type { PhoneCameraExecutorInput } from "@flowgram.ai/runtime-js";
import { Injectable } from "@nestjs/common";

import { CameraSessionService } from "../mobile/camera-session.service";
import { isMobileCameraEnabled } from "../mobile/is-mobile-camera-enabled";
import {
    clamp,
    collectPhoneCameraNodes,
    resolutionToEdge,
} from "../mobile/phone-camera-schema";

@Injectable()
export class WorkflowPhoneCameraExecutorService {
    constructor(private readonly cameraSessions: CameraSessionService) {}

    async execute(input: PhoneCameraExecutorInput): Promise<Record<string, unknown>> {
        if (!isMobileCameraEnabled()) {
            throw HttpErrorFactory.badRequest("手机摄像头未启用");
        }
        if (!input.userId) throw HttpErrorFactory.unauthorized("手机摄像头节点需要登录后执行");
        const taskId = input.runtimeContext?.workflowTaskId;
        if (!taskId) throw new Error("workflowTaskId missing from runtime metadata");
        const captureTimeoutMs = clamp(Number(input.node.data?.timeoutMs) || 30_000, 5_000, 120_000);
        const installationId = this.resolveInstallation(input);
        try {
            const session = await this.cameraSessions.ensureForNode({
                userId: input.userId,
                workflowTaskId: taskId,
                nodeId: input.node.id,
                installationId,
                config: input.node.data,
            });
            await this.cameraSessions.waitUntilPreviewing(session.id);
            const delay = clamp(Number(input.node.data?.captureDelayMs) || 0, 0, 10_000);
            if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
            const capture = await this.cameraSessions.requestCapture(session.id, {
                nodeId: input.node.id,
                facingHint: session.facingDefault,
                maxEdgePx: resolutionToEdge(input.node.data?.resolution),
                jpegQuality: Number(input.node.data?.jpegQuality) || session.jpegQuality,
                maxBytes: Number(input.node.data?.maxBytes) || session.maxBytes,
                timeoutMs: captureTimeoutMs,
            });
            const completed = await this.cameraSessions.waitForCapture(capture.captureId, captureTimeoutMs);
            if (completed.status !== "succeeded") {
                throw HttpErrorFactory.badRequest(completed.error?.message ?? "手机拍照失败", {
                    code: completed.error?.code,
                });
            }
            return {
                success: true,
                imageUrl: completed.imageUrl,
                fileId: completed.fileId,
                mimeType: "image/jpeg",
                width: completed.width,
                height: completed.height,
                size: completed.size,
                sha256: completed.sha256,
                facing: completed.facing,
                captureId: completed.id,
            };
        } finally {
            await this.cameraSessions.closeWhenAllNodeCapturesTerminal(taskId, installationId);
        }
    }

    private resolveInstallation(input: PhoneCameraExecutorInput): string {
        const node = collectPhoneCameraNodes({
            nodes: [{ id: input.node.id, type: "phone_camera", data: input.node.data }],
        })[0] ?? { id: input.node.id, data: input.node.data ?? {}, inLoop: false };
        return this.cameraSessions.resolveNodeInstallation(node, input.runtimeContext?.installationId);
    }
}
