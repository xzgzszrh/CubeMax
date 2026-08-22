import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    CameraCapture,
    type CameraCaptureStatus,
    CameraSession,
    type CameraSessionStatus,
    MobileInstallation,
} from "@buildingai/db/entities";
import { IsNull, LessThan, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { createHash, randomUUID, timingSafeEqual } from "crypto";
import type { Request } from "express";

import { mintCameraFileUrl, requestOrigin } from "./camera-file-url";
import { isMobileCameraEnabled } from "./is-mobile-camera-enabled";
import { isHeicMagic, isJpegMagic, parseJpegDimensions } from "./jpeg-sof";
import { MobileClientRegistry } from "./mobile-client-registry";
import { PRODUCT_CONSENT_TITLE, UUID_V4 } from "./mobile-protocol";
import {
    assertNoPhoneCameraInsideLoop,
    clamp,
    collectPhoneCameraNodes,
    maxClock,
    resolutionToEdge,
    schemaHasOpenCameraOnWorkflowStart,
    type PhoneCameraNodeConfig,
} from "./phone-camera-schema";

const TERMINAL_SESSION: CameraSessionStatus[] = ["closed", "failed", "cancelled", "timed_out"];
const TERMINAL_CAPTURE: CameraCaptureStatus[] = ["succeeded", "failed"];
const POLL_MS = 250;
const MAX_CAPTURE_BYTES = 2_097_152;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 5;

type SessionError = { code: string; message: string };

@Injectable()
export class CameraSessionService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(CameraSessionService.name);
    private readonly captureIdsSeen = new Map<string, number[]>();
    private readonly downloadHits = new Map<string, number[]>();
    private cleanupTimer?: NodeJS.Timeout;

    constructor(
        @InjectRepository(CameraSession)
        private readonly sessionRepository: Repository<CameraSession>,
        @InjectRepository(CameraCapture)
        private readonly captureRepository: Repository<CameraCapture>,
        @InjectRepository(MobileInstallation)
        private readonly installationRepository: Repository<MobileInstallation>,
        private readonly eventEmitter: EventEmitter2,
        private readonly clients: MobileClientRegistry,
    ) {}

    onApplicationBootstrap(): void {
        this.cleanupTimer = setInterval(() => void this.cleanupExpiredFiles(), 15 * 60 * 1000);
        this.cleanupTimer.unref();
    }

    onApplicationShutdown(): void {
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    }

    async upsertInstallation(params: {
        userId: string;
        installationId: string;
        platform: string;
        appVersion?: string;
        osVersion?: string;
        deviceModel?: string;
        capabilities: string[];
    }): Promise<MobileInstallation> {
        const others = await this.installationRepository.find({
            where: { installationId: params.installationId, supersededAt: IsNull() },
        });
        for (const row of others) {
            if (row.userId === params.userId) continue;
            row.supersededAt = new Date();
            await this.installationRepository.save(row);
            await this.closeInstallationSessions(row.userId, row.installationId, "installation_rebound");
        }

        let row = await this.installationRepository.findOne({
            where: { userId: params.userId, installationId: params.installationId },
        });
        if (!row) {
            row = this.installationRepository.create({
                userId: params.userId,
                installationId: params.installationId,
                platform: params.platform,
                capabilities: params.capabilities,
            });
        }
        row.platform = params.platform;
        row.appVersion = params.appVersion ?? null;
        row.osVersion = params.osVersion ?? null;
        row.deviceModel = params.deviceModel ?? null;
        row.capabilities = params.capabilities;
        row.lastSeenAt = new Date();
        row.supersededAt = null;
        return this.installationRepository.save(row);
    }

    async listInstallations(userId: string) {
        const rows = await this.installationRepository.find({
            where: { userId, supersededAt: IsNull() },
            order: { lastSeenAt: "DESC" },
        });
        return {
            items: rows.map((row) => ({
                installation_id: row.installationId,
                platform: row.platform,
                device_model: row.deviceModel,
                app_version: row.appVersion,
                online: this.clients.isOnline(userId, row.installationId),
                capabilities: row.capabilities,
                last_seen_at: row.lastSeenAt,
            })),
        };
    }

    async touchInstallation(userId: string, installationId: string): Promise<void> {
        await this.installationRepository.update(
            { userId, installationId },
            { lastSeenAt: new Date() },
        );
    }

    async warmup(params: {
        userId: string;
        workflowTaskId: string;
        schema: Record<string, unknown>;
        installationId?: string;
        title?: string;
        projectId?: string;
        consentTimeoutMs: number;
        previewMaxMs: number;
        emitSessionStart: boolean;
    }): Promise<void> {
        if (!isMobileCameraEnabled()) return;
        assertNoPhoneCameraInsideLoop(params.schema);
        const nodes = collectPhoneCameraNodes(params.schema);
        if (nodes.length === 0) return;

        const groups = new Map<string, PhoneCameraNodeConfig[]>();
        for (const node of nodes) {
            const installationId = this.resolveNodeInstallation(node, params.installationId);
            const list = groups.get(installationId) ?? [];
            list.push(node);
            groups.set(installationId, list);
        }

        for (const [installationId, group] of groups) {
            const emitStart =
                params.emitSessionStart && group.some((node) => node.data.openCameraOn !== "node_enter");
            const session = await this.upsertSession({
                userId: params.userId,
                installationId,
                workflowTaskId: params.workflowTaskId,
                title: params.title ?? "",
                projectId: params.projectId,
                nodeIds: group.map((node) => node.id),
                config: this.mergeGroupConfig(group, params.consentTimeoutMs, params.previewMaxMs),
            });
            if (emitStart) await this.emitSessionStart(session);
        }
    }

    async ensureForNode(params: {
        userId: string;
        workflowTaskId: string;
        nodeId: string;
        installationId: string;
        config?: Record<string, unknown>;
        title?: string;
        projectId?: string;
    }): Promise<CameraSession> {
        const session = await this.upsertSession({
            userId: params.userId,
            installationId: params.installationId,
            workflowTaskId: params.workflowTaskId,
            title: params.title ?? "",
            projectId: params.projectId,
            nodeIds: [params.nodeId],
            config: params.config ?? {},
        });
        if (session.status !== "previewing" && session.status !== "capturing") {
            await this.emitSessionStart(session);
        }
        return this.requireSessionById(session.id);
    }

    async waitUntilPreviewing(sessionId: string): Promise<CameraSession> {
        const initial = await this.requireSessionById(sessionId);
        const deadline = initial.consentDeadlineAt?.getTime() ?? Date.now() + (initial.consentTimeoutMs || 60_000);
        while (true) {
            const session = await this.requireSessionById(sessionId);
            if (session.status === "previewing") return session;
            if (session.status === "capturing") {
                await this.sleep(POLL_MS);
                continue;
            }
            if (TERMINAL_SESSION.includes(session.status)) {
                throw HttpErrorFactory.badRequest(
                    session.error?.message || this.defaultSessionError(session.status),
                    { code: session.error?.code || session.status.toUpperCase() },
                );
            }
            if (Date.now() > deadline) {
                await this.failSession(session, {
                    code: "CAMERA_DEVICE_OFFLINE",
                    message: "等待手机授权或上线超时",
                });
                throw HttpErrorFactory.badRequest("等待手机授权或上线超时", {
                    code: "CAMERA_DEVICE_OFFLINE",
                });
            }
            await this.sleep(POLL_MS);
        }
    }

    async requestCapture(
        sessionId: string,
        params: {
            nodeId: string;
            facingHint?: string;
            maxEdgePx?: number;
            jpegQuality?: number;
            maxBytes?: number;
            timeoutMs?: number;
        },
    ): Promise<{ captureId: string }> {
        const session = await this.requireSessionById(sessionId);
        if (session.status === "capturing") {
            await this.waitUntilPreviewing(sessionId);
        }
        const fresh = await this.requireSessionById(sessionId);
        if (fresh.status !== "previewing") {
            throw HttpErrorFactory.badRequest("预览尚未就绪，不能拍照", { code: "PREVIEW_NOT_READY" });
        }
        const capture = await this.captureRepository.save(
            this.captureRepository.create({
                sessionId: fresh.id,
                nodeId: params.nodeId,
                status: "pending",
            }),
        );
        fresh.status = "capturing";
        fresh.pendingCaptureId = capture.id;
        await this.sessionRepository.save(fresh);

        const messageId = this.clients.send(fresh.userId, fresh.installationId, "camera.capture", {
            session_id: fresh.id,
            capture_id: capture.id,
            facing_hint: params.facingHint || fresh.facingDefault,
            jpeg_quality: params.jpegQuality ?? fresh.jpegQuality,
            max_bytes: params.maxBytes ?? fresh.maxBytes,
            max_edge_px: params.maxEdgePx ?? fresh.maxEdgePx,
            timeout_ms: params.timeoutMs ?? 30_000,
            upload: { method: "POST", path: "/mobile/camera/captures", field: "file" },
            media: { kind: "image", mime_type: "image/jpeg", transport: "http_upload" },
        }, undefined, true);
        if (messageId) {
            capture.commandMessageId = messageId;
            await this.captureRepository.save(capture);
            this.clients.armCaptureRetry(fresh.userId, fresh.installationId, messageId);
        }
        this.eventEmitter.emit("camera.session.updated", { sessionId: fresh.id });
        return { captureId: capture.id };
    }

    async waitForCapture(captureId: string, timeoutMs: number): Promise<CameraCapture> {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const capture = await this.captureRepository.findOne({ where: { id: captureId } });
            if (!capture) throw HttpErrorFactory.notFound("拍摄记录不存在");
            if (TERMINAL_CAPTURE.includes(capture.status)) return capture;
            const session = await this.sessionRepository.findOne({ where: { id: capture.sessionId } });
            if (session && TERMINAL_SESSION.includes(session.status)) {
                capture.status = "failed";
                capture.error = session.error || { code: session.status.toUpperCase(), message: "会话已结束" };
                capture.completedAt = new Date();
                await this.captureRepository.save(capture);
                return capture;
            }
            await this.sleep(POLL_MS);
        }
        const capture = await this.captureRepository.findOne({ where: { id: captureId } });
        if (!capture) throw HttpErrorFactory.notFound("拍摄记录不存在");
        if (TERMINAL_CAPTURE.includes(capture.status)) return capture;
        capture.status = "failed";
        capture.error = { code: "CAPTURE_TIMEOUT", message: "拍照超时" };
        capture.completedAt = new Date();
        await this.captureRepository.save(capture);
        const session = await this.sessionRepository.findOne({ where: { id: capture.sessionId } });
        if (session && session.status === "capturing") {
            session.status = "previewing";
            session.pendingCaptureId = null;
            await this.sessionRepository.save(session);
            this.eventEmitter.emit("camera.session.updated", { sessionId: session.id });
        }
        return capture;
    }

    async closeWhenAllNodeCapturesTerminal(taskId: string, installationId?: string): Promise<void> {
        const sessions = await this.sessionRepository.find({
            where: installationId
                ? { workflowTaskId: taskId, installationId }
                : { workflowTaskId: taskId },
        });
        for (const session of sessions) {
            if (TERMINAL_SESSION.includes(session.status)) continue;
            if (!session.nodeIds.length) continue;
            let allDone = true;
            for (const nodeId of session.nodeIds) {
                const row = await this.captureRepository.findOne({
                    where: { sessionId: session.id, nodeId },
                });
                if (!row || !TERMINAL_CAPTURE.includes(row.status)) {
                    allDone = false;
                    break;
                }
            }
            if (allDone) await this.closeSession(session, "all_captures_terminal");
        }
    }

    async closeByTaskId(taskId: string, reason: string): Promise<void> {
        const sessions = await this.sessionRepository.find({ where: { workflowTaskId: taskId } });
        for (const session of sessions) {
            if (TERMINAL_SESSION.includes(session.status)) continue;
            await this.closeSession(session, reason);
        }
    }

    async closeInstallationSessions(userId: string, installationId: string, reason: string): Promise<void> {
        const sessions = await this.sessionRepository.find({ where: { userId, installationId } });
        for (const session of sessions) {
            if (TERMINAL_SESSION.includes(session.status)) continue;
            await this.closeSession(session, reason, { code: "TOKEN_REVOKED", message: reason });
        }
    }

    async markSessionReady(
        userId: string,
        installationId: string,
        sessionId: string,
        data: Record<string, unknown>,
    ): Promise<void> {
        const session = await this.requireOwnedSession(userId, installationId, sessionId);
        if (TERMINAL_SESSION.includes(session.status)) return;
        session.status = "previewing";
        session.readyAt = new Date();
        if (session.previewMaxMs > 0) {
            session.previewDeadlineAt = new Date(Date.now() + session.previewMaxMs);
        }
        if (typeof data.facing === "string") session.facingDefault = data.facing;
        await this.sessionRepository.save(session);
        this.eventEmitter.emit("camera.session.updated", { sessionId: session.id });
    }

    async markSessionRejected(
        userId: string,
        installationId: string,
        sessionId: string,
        reason: string,
    ): Promise<void> {
        const session = await this.requireOwnedSession(userId, installationId, sessionId);
        const code =
            reason === "product_consent_denied"
                ? "PRODUCT_CONSENT_DENIED"
                : reason === "system_permission_denied" || reason === "system_permission_restricted"
                  ? "SYSTEM_PERMISSION_DENIED"
                  : "CAMERA_UNAVAILABLE";
        await this.failSession(session, { code, message: reason });
    }

    async markSessionCancelled(
        userId: string,
        installationId: string,
        sessionId: string,
        reason: string,
    ): Promise<void> {
        const session = await this.requireOwnedSession(userId, installationId, sessionId);
        if (TERMINAL_SESSION.includes(session.status)) return;
        session.status = "cancelled";
        session.closedAt = new Date();
        session.error = { code: "USER_CLOSED", message: reason };
        await this.sessionRepository.save(session);
        this.eventEmitter.emit("camera.session.updated", { sessionId: session.id });
    }

    async onInstallationOnline(userId: string, installationId: string): Promise<void> {
        const sessions = await this.sessionRepository.find({
            where: { userId, installationId, status: "waiting_for_device" },
        });
        for (const session of sessions) {
            if (session.consentDeadlineAt && session.consentDeadlineAt.getTime() < Date.now()) {
                await this.failSession(session, {
                    code: "CAMERA_DEVICE_OFFLINE",
                    message: "等待手机上线超时",
                });
                continue;
            }
            await this.emitSessionStart(session);
        }
    }

    async completeUpload(params: {
        userId: string;
        installationId: string;
        sessionId: string;
        captureId: string;
        sha256: string;
        facing?: string;
        file: Express.Multer.File;
        request: Request;
        fileUpload: (file: Express.Multer.File, request: Request, description: string) => Promise<{
            id: string;
            url: string;
            originalName: string;
            size: number;
            mimeType: string;
        }>;
    }) {
        if (!UUID_V4.test(params.sessionId) || !UUID_V4.test(params.captureId)) {
            throw HttpErrorFactory.badRequest("session_id 或 capture_id 无效");
        }
        const session = await this.requireOwnedSession(
            params.userId,
            params.installationId,
            params.sessionId,
        );
        if (session.status !== "previewing" && session.status !== "capturing") {
            throw HttpErrorFactory.forbidden("当前会话不能接收照片");
        }
        const capture = await this.captureRepository.findOne({
            where: { id: params.captureId, sessionId: session.id },
        });
        if (!capture) throw HttpErrorFactory.notFound("拍摄记录不存在");

        const incomingHash = this.parseSha256(params.sha256);
        if (capture.status === "succeeded" && capture.sha256) {
            const previous = Buffer.from(capture.sha256, "hex");
            if (previous.length === 32 && timingSafeEqual(previous, incomingHash)) {
                return this.serializeCaptureResult(capture);
            }
            throw HttpErrorFactory.conflict("同一 capture_id 内容不一致");
        }

        this.assertCaptureRateLimit(params.installationId, params.captureId, capture.status);

        const buffer = params.file?.buffer;
        if (!buffer?.length) throw HttpErrorFactory.badRequest("缺少文件");
        if (isHeicMagic(buffer)) throw HttpErrorFactory.badRequest("不支持 HEIC，请上传 JPEG");
        if (!isJpegMagic(buffer) && params.file.mimetype !== "image/jpeg") {
            throw HttpErrorFactory.badRequest("文件必须是 JPEG");
        }
        if (!isJpegMagic(buffer)) throw HttpErrorFactory.badRequest("JPEG 魔数无效");
        const maxBytes = Math.min(session.maxBytes || MAX_CAPTURE_BYTES, MAX_CAPTURE_BYTES);
        if (buffer.length > maxBytes) throw HttpErrorFactory.badRequest("照片超过大小限制");

        const digest = createHash("sha256").update(buffer).digest();
        if (!timingSafeEqual(digest, incomingHash)) {
            throw HttpErrorFactory.badRequest("sha256 不匹配", { code: "HASH_MISMATCH" });
        }
        const dimensions = parseJpegDimensions(buffer);
        if (!dimensions) throw HttpErrorFactory.badRequest("无法解析 JPEG 尺寸");

        capture.status = "uploading";
        await this.captureRepository.save(capture);

        const uploaded = await params.fileUpload(
            params.file,
            params.request,
            `phone_camera:${session.id}:${capture.id}`,
        );
        const origin = requestOrigin(
            params.request.headers.host,
            (params.request.headers["x-forwarded-proto"] as string) || params.request.protocol,
        );
        const signed = mintCameraFileUrl(uploaded.id, session.imageUrlTtlSec || 3600, origin);

        capture.status = "succeeded";
        capture.fileId = uploaded.id;
        capture.imageUrl = signed.url;
        capture.sha256 = digest.toString("hex");
        capture.size = buffer.length;
        capture.width = dimensions.width;
        capture.height = dimensions.height;
        capture.facing = params.facing === "front" ? "front" : "back";
        capture.expiresAt = new Date(signed.exp * 1000);
        capture.completedAt = new Date();
        capture.error = null;
        await this.captureRepository.save(capture);

        if (session.status === "capturing") session.status = "previewing";
        session.pendingCaptureId = null;
        await this.sessionRepository.save(session);
        this.eventEmitter.emit("camera.capture.updated", { captureId: capture.id });
        this.eventEmitter.emit("camera.session.updated", { sessionId: session.id });
        return this.serializeCaptureResult(capture);
    }

    async createForTest(params: { userId: string; installationId: string }): Promise<{
        session: CameraSession;
        capture: CameraCapture;
    }> {
        if (process.env.NODE_ENV !== "test") {
            throw HttpErrorFactory.forbidden("createForTest 仅测试可用");
        }
        const session = await this.sessionRepository.save(
            this.sessionRepository.create({
                userId: params.userId,
                installationId: params.installationId,
                workflowTaskId: randomUUID(),
                title: "test",
                nodeIds: ["node_test"],
                status: "previewing",
            }),
        );
        const capture = await this.captureRepository.save(
            this.captureRepository.create({
                sessionId: session.id,
                nodeId: "node_test",
                status: "pending",
            }),
        );
        return { session, capture };
    }

    noteDownload(ip: string): void {
        const now = Date.now();
        const hits = (this.downloadHits.get(ip) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS);
        if (hits.length >= 60) throw HttpErrorFactory.tooManyRequests("下载过于频繁");
        hits.push(now);
        this.downloadHits.set(ip, hits);
    }

    resolveNodeInstallation(node: PhoneCameraNodeConfig, triggeringInstallationId?: string): string {
        const binding = node.data.deviceBinding === "specific" ? "specific" : "triggering_device";
        if (binding === "specific") {
            const installationId = String(node.data.installationId || "");
            if (!UUID_V4.test(installationId)) {
                throw HttpErrorFactory.badRequest("请在节点中指定拍摄设备，或从 CubeMax 运行", {
                    code: "CAMERA_NO_TARGET_DEVICE",
                });
            }
            return installationId;
        }
        if (!triggeringInstallationId || !UUID_V4.test(triggeringInstallationId)) {
            throw HttpErrorFactory.badRequest("请在节点中指定拍摄设备，或从 CubeMax 运行", {
                code: "CAMERA_NO_TARGET_DEVICE",
            });
        }
        return triggeringInstallationId;
    }

    private async upsertSession(params: {
        userId: string;
        installationId: string;
        workflowTaskId: string;
        title: string;
        projectId?: string;
        nodeIds: string[];
        config: Record<string, unknown>;
    }): Promise<CameraSession> {
        let session = await this.sessionRepository.findOne({
            where: { workflowTaskId: params.workflowTaskId, installationId: params.installationId },
        });
        const facing = params.config.facingDefault === "front" ? "front" : "back";
        const jpegQuality = clamp(Number(params.config.jpegQuality) || 0.8, 0.5, 0.95);
        const consentTimeoutMs = clamp(Number(params.config.consentTimeoutMs) || 60_000, 10_000, 120_000);
        const previewMaxMsRaw = Number(params.config.previewMaxMs);
        const previewMaxMs = previewMaxMsRaw === 0 ? 0 : clamp(previewMaxMsRaw || 600_000, 60_000, 1_800_000);
        const imageUrlTtlSec = clamp(Number(params.config.imageUrlTtlSec) || 3600, 300, 86_400);
        if (!session) {
            session = this.sessionRepository.create({
                userId: params.userId,
                installationId: params.installationId,
                workflowTaskId: params.workflowTaskId,
                title: params.title.slice(0, 100),
                projectId: params.projectId ?? null,
                nodeIds: params.nodeIds,
                status: "created",
                facingDefault: facing,
                allowSwitchFacing: params.config.allowSwitchFacing !== false,
                resolution: typeof params.config.resolution === "string" ? params.config.resolution : "1080p",
                jpegQuality,
                maxBytes: clamp(Number(params.config.maxBytes) || MAX_CAPTURE_BYTES, 50_000, MAX_CAPTURE_BYTES),
                maxEdgePx: resolutionToEdge(params.config.resolution),
                consentTimeoutMs,
                previewMaxMs,
                imageUrlTtlSec,
            });
        } else {
            session.nodeIds = Array.from(new Set([...(session.nodeIds || []), ...params.nodeIds]));
            session.consentTimeoutMs = Math.max(session.consentTimeoutMs, consentTimeoutMs);
            session.previewMaxMs = Math.max(session.previewMaxMs, previewMaxMs);
            session.imageUrlTtlSec = Math.max(session.imageUrlTtlSec, imageUrlTtlSec);
        }
        return this.sessionRepository.save(session);
    }

    private mergeGroupConfig(
        group: PhoneCameraNodeConfig[],
        consentTimeoutMs: number,
        previewMaxMs: number,
    ): Record<string, unknown> {
        const first = group[0]?.data ?? {};
        return {
            ...first,
            consentTimeoutMs: Math.max(consentTimeoutMs, maxClock({ nodes: group.map((n) => ({ ...n, type: "phone_camera" })) } as never, "consentTimeoutMs", consentTimeoutMs)),
            previewMaxMs: Math.max(previewMaxMs, ...group.map((n) => Number(n.data.previewMaxMs) || previewMaxMs)),
            imageUrlTtlSec: Math.max(...group.map((n) => Number(n.data.imageUrlTtlSec) || 3600)),
        };
    }

    private async emitSessionStart(session: CameraSession): Promise<void> {
        if (!isMobileCameraEnabled()) return;
        const online = this.clients.isOnline(session.userId, session.installationId);
        session.startedAt = session.startedAt ?? new Date();
        session.consentDeadlineAt = new Date(Date.now() + (session.consentTimeoutMs || 60_000));
        if (!online) {
            session.status = "waiting_for_device";
            await this.sessionRepository.save(session);
            this.eventEmitter.emit("camera.session.updated", { sessionId: session.id });
            return;
        }
        session.status = "notifying";
        await this.sessionRepository.save(session);
        this.clients.send(session.userId, session.installationId, "camera.session.start", {
            session_id: session.id,
            workflow_task_id: session.workflowTaskId,
            title: session.title,
            consent_prompt: PRODUCT_CONSENT_TITLE,
            facing_default: session.facingDefault,
            allow_switch_facing: session.allowSwitchFacing,
            resolution: session.resolution,
            jpeg_quality: session.jpegQuality,
            max_bytes: session.maxBytes,
            max_edge_px: session.maxEdgePx,
            consent_timeout_ms: session.consentTimeoutMs,
            preview_max_ms: session.previewMaxMs,
            media: { kind: "image", mime_type: "image/jpeg", transport: "http_upload" },
        });
        session.status = "awaiting_consent";
        await this.sessionRepository.save(session);
        this.eventEmitter.emit("camera.session.updated", { sessionId: session.id });
    }

    private async closeSession(
        session: CameraSession,
        reason: string,
        error?: SessionError,
    ): Promise<void> {
        if (TERMINAL_SESSION.includes(session.status)) return;
        session.status = reason === "workflow_cancelled" ? "cancelled" : "closed";
        session.closedAt = new Date();
        if (error) session.error = error;
        await this.sessionRepository.save(session);
        this.clients.send(session.userId, session.installationId, "camera.session.close", {
            session_id: session.id,
            reason,
        });
        this.eventEmitter.emit("camera.session.updated", { sessionId: session.id });
    }

    private async failSession(session: CameraSession, error: SessionError): Promise<void> {
        if (TERMINAL_SESSION.includes(session.status)) return;
        session.status = error.code.includes("TIMEOUT") || error.code.includes("OFFLINE") ? "timed_out" : "failed";
        session.closedAt = new Date();
        session.error = error;
        await this.sessionRepository.save(session);
        this.clients.send(session.userId, session.installationId, "camera.session.close", {
            session_id: session.id,
            reason: error.code,
        });
        this.eventEmitter.emit("camera.session.updated", { sessionId: session.id });
    }

    private async requireSessionById(id: string): Promise<CameraSession> {
        const session = await this.sessionRepository.findOne({ where: { id } });
        if (!session) throw HttpErrorFactory.notFound("摄像头会话不存在");
        if (
            session.status === "previewing" &&
            session.previewDeadlineAt &&
            session.previewDeadlineAt.getTime() < Date.now()
        ) {
            await this.failSession(session, { code: "PREVIEW_TIMEOUT", message: "预览超时" });
            const timedOut = await this.sessionRepository.findOne({ where: { id } });
            if (!timedOut) throw HttpErrorFactory.notFound("摄像头会话不存在");
            return timedOut;
        }
        return session;
    }

    private async requireOwnedSession(
        userId: string,
        installationId: string,
        sessionId: string,
    ): Promise<CameraSession> {
        const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
        if (!session) throw HttpErrorFactory.notFound("摄像头会话不存在");
        if (session.userId !== userId || session.installationId !== installationId) {
            throw HttpErrorFactory.forbidden("会话不属于当前安装");
        }
        return session;
    }

    private parseSha256(value: string): Buffer {
        if (!/^[0-9a-f]{64}$/.test(value)) throw HttpErrorFactory.badRequest("sha256 格式无效");
        return Buffer.from(value, "hex");
    }

    private assertCaptureRateLimit(
        installationId: string,
        captureId: string,
        status: CameraCaptureStatus,
    ): void {
        if (status !== "pending") return;
        const now = Date.now();
        const hits = (this.captureIdsSeen.get(installationId) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS);
        const key = `${installationId}:${captureId}`;
        if (!this.captureIdsSeen.has(key)) {
            if (hits.length >= RATE_LIMIT) throw HttpErrorFactory.tooManyRequests("拍照过于频繁");
            hits.push(now);
            this.captureIdsSeen.set(installationId, hits);
            this.captureIdsSeen.set(key, [now]);
        }
    }

    private serializeCaptureResult(capture: CameraCapture) {
        return {
            capture_id: capture.id,
            session_id: capture.sessionId,
            file_id: capture.fileId,
            url: capture.imageUrl,
            original_name: `camera-capture-${capture.id}.jpg`,
            mime_type: "image/jpeg",
            size: capture.size,
            sha256: capture.sha256,
            width: capture.width,
            height: capture.height,
            facing: capture.facing,
            expires_at: capture.expiresAt,
        };
    }

    private defaultSessionError(status: CameraSessionStatus): string {
        if (status === "timed_out") return "等待手机超时";
        if (status === "cancelled") return "摄像头会话已取消";
        return "摄像头会话已结束";
    }

    private async cleanupExpiredFiles(): Promise<void> {
        const expired = await this.captureRepository.find({
            where: { expiresAt: LessThan(new Date()), status: "succeeded" },
            take: 200,
        });
        this.eventEmitter.emit("camera.files.expired", {
            fileIds: expired.map((row) => row.fileId).filter(Boolean),
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
