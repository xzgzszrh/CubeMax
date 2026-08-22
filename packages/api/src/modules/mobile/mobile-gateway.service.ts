import { AuthService } from "@common/modules/auth/services/auth.service";
import { HttpUpgradeRouter } from "@common/ws/http-upgrade-router";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { MobileConnection } from "@buildingai/db/entities";
import { UserTerminal } from "@buildingai/constants/shared/status-codes.constant";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { randomUUID } from "crypto";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocket, WebSocketServer, type RawData } from "ws";

import { CameraSessionService } from "./camera-session.service";
import { MobileClientRegistry } from "./mobile-client-registry";
import {
    CLOSE_BINARY,
    CLOSE_HELLO_TIMEOUT,
    CLOSE_REPLACED,
    CLOSE_UNAUTHORIZED,
    MOBILE_HEARTBEAT_INTERVAL_MS,
    MOBILE_HELLO_TIMEOUT_MS,
    MOBILE_WS_MAX_MESSAGE_BYTES,
    UUID_V4,
    errorCodeForUnknownType,
    mobileWebsocketPath,
    parseEnvelope,
    stringField,
    type MobileEnvelope,
} from "./mobile-protocol";

type ClientState = {
    ready: boolean;
    helloTimer: NodeJS.Timeout;
    alive: boolean;
    userId?: string;
    token?: string;
    installationId?: string;
    connectionId?: string;
    pending: Map<string, PendingCommand>;
};

type PendingCommand = {
    type: string;
    envelope: string;
    retryCount: number;
    retryTimer?: NodeJS.Timeout;
};

@Injectable()
export class MobileGatewayService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(MobileGatewayService.name);
    private readonly server = new WebSocketServer({
        noServer: true,
        maxPayload: MOBILE_WS_MAX_MESSAGE_BYTES,
    });
    private readonly states = new WeakMap<WebSocket, ClientState>();
    private heartbeatTimer?: NodeJS.Timeout;

    constructor(
        private readonly upgradeRouter: HttpUpgradeRouter,
        private readonly authService: AuthService,
        @InjectRepository(MobileConnection)
        private readonly connectionRepository: Repository<MobileConnection>,
        private readonly cameraSessions: CameraSessionService,
        private readonly clients: MobileClientRegistry,
    ) {}

    onApplicationBootstrap(): void {
        this.upgradeRouter.register(this.websocketPath, this.handleUpgrade);
        this.server.on("connection", this.handleConnection);
        this.heartbeatTimer = setInterval(() => this.heartbeat(), MOBILE_HEARTBEAT_INTERVAL_MS);
        this.heartbeatTimer.unref();
        this.logger.log(`Mobile WebSocket gateway mounted at ${this.websocketPath}`);
    }

    async onApplicationShutdown(): Promise<void> {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        for (const [, client] of this.clients.entries()) client.socket.close(1001, "server shutdown");
        this.server.close();
    }

    get websocketPath(): string {
        return mobileWebsocketPath();
    }

    isOnline(userId: string, installationId: string): boolean {
        return this.clients.isOnline(userId, installationId);
    }

    send(
        userId: string,
        installationId: string,
        type: string,
        data: Record<string, unknown>,
        replyTo?: string,
    ): string | null {
        return this.clients.send(userId, installationId, type, data, replyTo);
    }

    closeUser(userId: string, code: number, reason: string): void {
        this.clients.closeUser(userId, code, reason);
    }

    @OnEvent("auth.token.revoked")
    async onTokenRevoked(payload: { userId: string; terminal?: number }): Promise<void> {
        if (payload.terminal !== undefined && payload.terminal !== UserTerminal.APP) return;
        this.closeUser(payload.userId, CLOSE_UNAUTHORIZED, "token revoked");
        for (const client of this.clients.forUser(payload.userId)) {
            await this.cameraSessions.closeInstallationSessions(
                payload.userId,
                client.installationId,
                "TOKEN_REVOKED",
            );
        }
    }

    private readonly handleUpgrade = (
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer,
    ): void => {
        const host = String(request.headers.host || "");
        const proto =
            String(request.headers["x-forwarded-proto"] || "").split(",")[0] ||
            ((request.socket as { encrypted?: boolean }).encrypted ? "https" : "http");
        if (host.includes("max.sh.creativone.cn") && proto !== "https") {
            socket.destroy();
            return;
        }
        this.server.handleUpgrade(request, socket, head, (websocket) => {
            this.server.emit("connection", websocket, request);
        });
    };

    private readonly handleConnection = (socket: WebSocket, request: IncomingMessage): void => {
        const token = this.readBearer(request);
        const installationHeader = String(request.headers["x-installation-id"] || "").toLowerCase();
        const state: ClientState = {
            ready: false,
            alive: true,
            pending: new Map(),
            helloTimer: setTimeout(() => socket.close(CLOSE_HELLO_TIMEOUT, "hello timeout"), MOBILE_HELLO_TIMEOUT_MS),
        };
        state.helloTimer.unref();
        this.states.set(socket, state);
        (state as ClientState & { remoteAddress?: string; installationHeader?: string }).remoteAddress =
            request.socket.remoteAddress;
        (state as ClientState & { installationHeader?: string }).installationHeader = installationHeader;

        void this.authenticateUpgrade(socket, state, token);

        socket.on("pong", () => (state.alive = true));
        socket.on("message", (data, binary) => void this.handleMessage(socket, data, binary));
        socket.on("close", (code) => void this.handleClose(socket, code));
        socket.on("error", (error) => this.logger.warn(`Mobile socket error: ${error.message}`));
    };

    private async authenticateUpgrade(socket: WebSocket, state: ClientState, token?: string): Promise<void> {
        const result = await this.authService.validateToken(token);
        if (!result.isValid || !result.user) {
            socket.close(CLOSE_UNAUTHORIZED, "unauthorized");
            return;
        }
        state.userId = result.user.id;
        state.token = token;
    }

    private async handleMessage(socket: WebSocket, raw: RawData, binary: boolean): Promise<void> {
        if (binary) {
            socket.close(CLOSE_BINARY, "binary frames are not supported");
            return;
        }
        const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
        if (bytes.length > MOBILE_WS_MAX_MESSAGE_BYTES) {
            socket.close(CLOSE_HELLO_TIMEOUT, "message too large");
            return;
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(bytes.toString("utf8"));
        } catch {
            this.sendTo(socket, "error", {
                code: "INVALID_MESSAGE",
                message: "invalid JSON envelope",
                retryable: false,
            });
            return;
        }
        const envelope = parseEnvelope(parsed);
        if (!envelope) {
            this.sendTo(socket, "error", {
                code: "INVALID_MESSAGE",
                message: "invalid envelope",
                retryable: false,
            });
            return;
        }
        const state = this.states.get(socket);
        if (!state?.userId) {
            socket.close(CLOSE_UNAUTHORIZED, "unauthorized");
            return;
        }
        if (!state.ready) {
            if (envelope.type !== "hello") {
                this.sendTo(socket, "error", {
                    code: "HELLO_REQUIRED",
                    message: "hello required",
                    retryable: false,
                }, envelope.id);
                socket.close(CLOSE_HELLO_TIMEOUT, "hello required");
                return;
            }
            await this.registerHello(socket, state, envelope);
            return;
        }
        try {
            await this.handleReadyMessage(socket, state, envelope);
        } catch (error) {
            this.logger.error(`Mobile message ${envelope.type} failed`, error);
            this.sendTo(
                socket,
                "error",
                { code: "INTERNAL_ERROR", message: "message processing failed", retryable: true },
                envelope.id,
            );
        }
    }

    private async registerHello(socket: WebSocket, state: ClientState, envelope: MobileEnvelope): Promise<void> {
        const data = envelope.data;
        const installationId = stringField(data, "installation_id")?.toLowerCase();
        const platform = stringField(data, "platform");
        const headerId = (state as ClientState & { installationHeader?: string }).installationHeader;
        if (!installationId || !UUID_V4.test(installationId) || installationId !== headerId) {
            socket.close(CLOSE_HELLO_TIMEOUT, "invalid hello");
            return;
        }
        if (platform !== "ios") {
            this.sendTo(
                socket,
                "error",
                { code: "UNSUPPORTED_PLATFORM", message: "platform must be ios", retryable: false },
                envelope.id,
            );
            socket.close(CLOSE_HELLO_TIMEOUT, "unsupported platform");
            return;
        }
        const capabilities = Array.isArray(data.capabilities)
            ? data.capabilities.filter((item): item is string => typeof item === "string")
            : [];
        await this.cameraSessions.upsertInstallation({
            userId: state.userId!,
            installationId,
            platform: "ios",
            appVersion: stringField(data, "app_version"),
            osVersion: stringField(data, "os_version"),
            deviceModel: stringField(data, "device_model"),
            capabilities: capabilities.length ? capabilities : ["camera.photo"],
        });

        clearTimeout(state.helloTimer);
        state.ready = true;
        state.installationId = installationId;
        state.connectionId = randomUUID();
        const previous = this.clients.set({
            socket,
            userId: state.userId!,
            installationId,
            pending: new Map(),
        });
        if (previous) previous.socket.close(CLOSE_REPLACED, "replaced");

        await this.connectionRepository.save(
            this.connectionRepository.create({
                connectionId: state.connectionId,
                userId: state.userId!,
                installationId,
                remoteAddress: (state as ClientState & { remoteAddress?: string }).remoteAddress,
                connectedAt: new Date(),
            }),
        );
        this.sendTo(
            socket,
            "hello.welcome",
            {
                connection_id: state.connectionId,
                heartbeat_interval_ms: 20_000,
                user_id: state.userId,
                server_limits: {
                    max_capture_bytes: 2_097_152,
                    max_message_bytes: MOBILE_WS_MAX_MESSAGE_BYTES,
                },
            },
            envelope.id,
        );
        await this.cameraSessions.onInstallationOnline(state.userId!, installationId);
    }

    private async handleReadyMessage(
        socket: WebSocket,
        state: ClientState,
        envelope: MobileEnvelope,
    ): Promise<void> {
        if (envelope.type === "device.status") {
            const tokenResult = await this.authService.validateToken(state.token);
            if (!tokenResult.isValid) {
                socket.close(CLOSE_UNAUTHORIZED, "unauthorized");
                return;
            }
            if (state.userId && state.installationId) {
                await this.cameraSessions.touchInstallation(state.userId, state.installationId);
            }
            return;
        }
        if (!state.userId || !state.installationId) return;
        const sessionId = stringField(envelope.data, "session_id") || "";
        switch (envelope.type) {
            case "camera.session.ready":
                await this.cameraSessions.markSessionReady(
                    state.userId,
                    state.installationId,
                    sessionId,
                    envelope.data,
                );
                return;
            case "camera.session.rejected":
                await this.cameraSessions.markSessionRejected(
                    state.userId,
                    state.installationId,
                    sessionId,
                    stringField(envelope.data, "reason") || "product_consent_denied",
                );
                return;
            case "camera.session.cancel":
                await this.cameraSessions.markSessionCancelled(
                    state.userId,
                    state.installationId,
                    sessionId,
                    stringField(envelope.data, "reason") || "user_closed",
                );
                return;
            case "camera.session.state":
                return;
            case "camera.capture.accepted":
            case "camera.capture.result":
                this.clients.clearPending(state.userId, state.installationId, envelope.reply_to);
                return;
            case "error":
                this.clients.clearPending(state.userId, state.installationId, envelope.reply_to);
                return;
            default:
                this.sendTo(
                    socket,
                    "error",
                    {
                        code: errorCodeForUnknownType(envelope.type),
                        message: `unsupported message type: ${envelope.type}`,
                        retryable: false,
                    },
                    envelope.id,
                );
        }
    }

    private async handleClose(socket: WebSocket, code: number): Promise<void> {
        const state = this.states.get(socket);
        if (!state) return;
        clearTimeout(state.helloTimer);
        this.clients.deleteIf(socket, state.userId, state.installationId);
        for (const pending of state.pending.values()) {
            if (pending.retryTimer) clearTimeout(pending.retryTimer);
        }
        state.pending.clear();
        if (state.connectionId) {
            await this.connectionRepository.update(
                { connectionId: state.connectionId },
                { disconnectedAt: new Date(), closeCode: code },
            );
        }
    }

    private heartbeat(): void {
        for (const [, client] of this.clients.entries()) {
            const state = this.states.get(client.socket);
            if (!state) continue;
            if (!state.alive) {
                client.socket.terminate();
                this.clients.deleteIf(client.socket, client.userId, client.installationId);
                continue;
            }
            state.alive = false;
            client.socket.ping();
        }
    }

    private sendTo(socket: WebSocket, type: string, data: Record<string, unknown>, replyTo?: string): string {
        const id = randomUUID();
        const envelope: MobileEnvelope = { v: 1, type, id, ts: new Date().toISOString(), data };
        if (replyTo) envelope.reply_to = replyTo;
        const serialized = JSON.stringify(envelope);
        const state = this.states.get(socket);
        if (state && (type === "camera.capture" || type === "camera.session.start")) {
            state.pending.set(id, { type, envelope: serialized, retryCount: 0 });
        }
        if (socket.readyState === WebSocket.OPEN) socket.send(serialized);
        return id;
    }

    private readBearer(request: IncomingMessage): string | undefined {
        const header = request.headers.authorization;
        if (typeof header !== "string" || !header.startsWith("Bearer ")) return undefined;
        return header.slice(7);
    }
}
