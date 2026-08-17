import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import type { LuaDeviceLimits } from "@buildingai/db/entities/lua-device.entity";
import {
    LuaDeviceConnection,
    LuaDeviceRun,
    LuaDeviceRunLog,
    LuaPhysicalDevice,
} from "@buildingai/db/entities/lua-device.entity";
import { In, MoreThan, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { createHash, randomUUID } from "crypto";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import { WebSocket, WebSocketServer, type RawData } from "ws";

import type { CreateLuaDeviceRunDto } from "./lua-device.dto";
import { calculateLuaChunkCrc32 } from "./lua-device-protocol";

const MAX_MESSAGE_BYTES = 24_576;
const HELLO_TIMEOUT_MS = 10_000;
const CHUNK_ACK_TIMEOUT_MS = 5_000;
const MAX_CHUNK_RETRIES = 3;
const TERMINAL_STATUSES = ["succeeded", "failed", "stopped", "timed_out"] as const;

type Envelope = {
    v: 1;
    type: string;
    id: string;
    ts: string;
    reply_to?: string;
    data: Record<string, unknown>;
};

type ClientState = {
    ready: boolean;
    helloTimer: NodeJS.Timeout;
    alive: boolean;
    deviceId?: string;
    bootId?: string;
    connectionId?: string;
    pending: Map<string, PendingRequest>;
};

type PendingRequest = {
    runId: string;
    type: string;
    envelope: string;
    retryCount: number;
    chunkIndex?: number;
    retryTimer?: NodeJS.Timeout;
};

type OnlineClient = { socket: WebSocket; state: ClientState };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
    return typeof value[key] === "string" ? value[key] : undefined;
}

function numberField(value: Record<string, unknown>, key: string): number | undefined {
    return typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] : undefined;
}

function sha256(value: Buffer | string): string {
    return createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class LuaDeviceGatewayService implements OnApplicationBootstrap, OnApplicationShutdown {
    private readonly logger = new Logger(LuaDeviceGatewayService.name);
    private readonly server = new WebSocketServer({
        noServer: true,
        maxPayload: MAX_MESSAGE_BYTES,
    });
    private readonly clients = new Map<string, OnlineClient>();
    private readonly states = new WeakMap<WebSocket, ClientState>();
    private heartbeatTimer?: NodeJS.Timeout;
    private httpServer?: { on: Function; off: Function };

    constructor(
        private readonly adapterHost: HttpAdapterHost,
        @InjectRepository(LuaPhysicalDevice)
        private readonly deviceRepository: Repository<LuaPhysicalDevice>,
        @InjectRepository(LuaDeviceConnection)
        private readonly connectionRepository: Repository<LuaDeviceConnection>,
        @InjectRepository(LuaDeviceRun)
        private readonly runRepository: Repository<LuaDeviceRun>,
        @InjectRepository(LuaDeviceRunLog)
        private readonly logRepository: Repository<LuaDeviceRunLog>,
    ) {}

    onApplicationBootstrap(): void {
        this.httpServer = this.adapterHost.httpAdapter.getHttpServer();
        this.httpServer.on("upgrade", this.handleUpgrade);
        this.server.on("connection", this.handleConnection);
        this.heartbeatTimer = setInterval(() => this.heartbeat(), 25_000);
        this.heartbeatTimer.unref();
        this.logger.log(`Device WebSocket gateway mounted at ${this.websocketPath}`);
    }

    async onApplicationShutdown(): Promise<void> {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.httpServer?.off("upgrade", this.handleUpgrade);
        for (const client of this.clients.values()) client.socket.close(1001, "server shutdown");
        this.server.close();
    }

    get websocketPath(): string {
        const prefix = (process.env.VITE_APP_WEB_API_PREFIX || "/api").replace(/\/$/, "");
        return `${prefix}/device-ws/v1`;
    }

    async listDevices() {
        const devices = await this.deviceRepository.find({
            order: { updatedAt: "DESC" },
        });
        return devices.map((device) => this.serializeDevice(device));
    }

    async listAllDevices() {
        return this.listDevices();
    }

    async listRuns(userId: string, deviceId: string) {
        const device = await this.requireDevice(deviceId);
        const runs = await this.runRepository.find({
            where: { createBy: userId, deviceId: device.deviceId },
            order: { createdAt: "DESC" },
            take: 50,
        });
        return runs.map((run) => this.serializeRun(run));
    }

    async getRun(userId: string, deviceId: string, runId: string) {
        return this.serializeRun(await this.requireOwnedRun(userId, deviceId, runId));
    }

    async getRunLogs(userId: string, deviceId: string, runId: string, after: number) {
        await this.requireOwnedRun(userId, deviceId, runId);
        return this.logRepository.find({
            where: { runId, sequence: MoreThan(after) },
            order: { sequence: "ASC" },
            take: 500,
        });
    }

    async createRun(userId: string, deviceId: string, dto: CreateLuaDeviceRunDto) {
        const device = await this.requireDevice(deviceId);
        deviceId = device.deviceId;
        const source = Buffer.from(dto.source, "utf8");
        const paramsJson = JSON.stringify(dto.params);
        const params = Buffer.from(paramsJson, "utf8");
        const limits = device.limits;
        const maxSource = Math.min(65_536, limits?.maxScriptBytes ?? 65_536);
        const maxParams = Math.min(4_096, limits?.maxParamsBytes ?? 4_096);
        if (source.length > maxSource) throw HttpErrorFactory.badRequest("Lua 源码超过设备限制");
        if (params.length > maxParams) throw HttpErrorFactory.badRequest("运行参数超过设备限制");

        const requiredCapabilities = dto.requiredCapabilities ?? ["lua", "xiaozhi"];
        if (device.capabilities.length > 0) {
            const unsupported = requiredCapabilities.filter(
                (capability) => !device.capabilities.includes(capability),
            );
            if (unsupported.length > 0) {
                throw HttpErrorFactory.badRequest(`设备不支持能力：${unsupported.join(", ")}`);
            }
        }
        const timeoutMs = dto.timeoutMs ?? 10_000;
        const maxTimeout = Math.min(60_000, device.runtime?.maxRunTimeoutMs ?? 60_000);
        if (timeoutMs > maxTimeout) throw HttpErrorFactory.badRequest("运行超时超过设备限制");

        const activeRun = await this.runRepository.findOne({
            where: {
                deviceId,
                status: In([
                    "preparing",
                    "transferring",
                    "running",
                    "stopping",
                    "waiting_for_device",
                ]),
            },
        });
        const canDispatch = this.clients.has(deviceId) && !activeRun;
        const run = await this.runRepository.save(
            this.runRepository.create({
                deviceId,
                createBy: userId,
                moduleId: dto.moduleId,
                projectId: dto.projectId,
                name: dto.name.trim(),
                source: dto.source,
                sourceSha256: sha256(source),
                params: dto.params,
                paramsJson,
                paramsSha256: sha256(params),
                requiredCapabilities,
                status: canDispatch ? "preparing" : "queued",
                timeoutMs,
                chunkBytes: Math.min(1024, limits?.maxChunkBytes ?? 1024),
                nextChunkIndex: 0,
            }),
        );
        if (canDispatch) await this.sendPrepare(run);
        return this.serializeRun(run);
    }

    async stopRun(userId: string, deviceId: string, runId: string) {
        const run = await this.requireOwnedRun(userId, deviceId, runId);
        if (TERMINAL_STATUSES.includes(run.status as (typeof TERMINAL_STATUSES)[number])) {
            return this.serializeRun(run);
        }
        deviceId = run.deviceId;
        if (run.status === "queued") {
            run.status = "stopped";
            run.finishedAt = new Date();
            run.error = { code: "RUN_STOPPED", message: "任务在下发前已取消" };
            await this.runRepository.save(run);
            return this.serializeRun(run);
        }
        const client = this.clients.get(deviceId);
        if (!client) {
            run.status = "stopping";
            run.error = { code: "STOP_PENDING", message: "设备离线，停止请求将在重连后发送" };
        } else {
            this.send(client, "run.stop", { run_id: run.id, reason: "user_request" }, run.id);
            run.status = "stopping";
        }
        await this.runRepository.save(run);
        return this.serializeRun(run);
    }

    async waitForRun(userId: string, deviceId: string, runId: string, maxWaitMs = 65_000) {
        const deadline = Date.now() + maxWaitMs;
        while (Date.now() < deadline) {
            const run = await this.requireOwnedRun(userId, deviceId, runId);
            if (TERMINAL_STATUSES.includes(run.status as (typeof TERMINAL_STATUSES)[number])) {
                return this.serializeRun(run);
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 250));
        }
        throw HttpErrorFactory.badRequest("等待 CubeCat 执行结果超时");
    }

    private readonly handleUpgrade = (
        request: IncomingMessage,
        socket: Duplex,
        head: Buffer,
    ): void => {
        let pathname: string;
        try {
            pathname = new URL(request.url || "/", "http://localhost").pathname;
        } catch {
            socket.destroy();
            return;
        }
        if (pathname !== this.websocketPath) {
            socket.destroy();
            return;
        }
        this.server.handleUpgrade(request, socket, head, (websocket) => {
            this.server.emit("connection", websocket, request);
        });
    };

    private readonly handleConnection = (socket: WebSocket, request: IncomingMessage): void => {
        const state: ClientState = {
            ready: false,
            alive: true,
            pending: new Map(),
            helloTimer: setTimeout(
                () => socket.close(4401, "hello timeout"),
                HELLO_TIMEOUT_MS,
            ),
        };
        state.helloTimer.unref();
        this.states.set(socket, state);
        socket.on("pong", () => (state.alive = true));
        socket.on("message", (data, binary) => void this.handleMessage(socket, data, binary));
        socket.on("close", (code) => void this.handleClose(socket, code));
        socket.on("error", (error) => this.logger.warn(`Device socket error: ${error.message}`));
        (state as ClientState & { remoteAddress?: string }).remoteAddress =
            request.socket.remoteAddress;
    };

    private async handleMessage(socket: WebSocket, raw: RawData, binary: boolean): Promise<void> {
        if (binary) return this.closeProtocol(socket, "binary frames are not supported");
        const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
        if (bytes.length > MAX_MESSAGE_BYTES)
            return this.closeProtocol(socket, "message too large");
        let envelope: Envelope;
        try {
            const parsed: unknown = JSON.parse(bytes.toString("utf8"));
            if (
                !isRecord(parsed) ||
                parsed.v !== 1 ||
                typeof parsed.type !== "string" ||
                typeof parsed.id !== "string" ||
                typeof parsed.ts !== "string" ||
                !isRecord(parsed.data)
            ) {
                throw new Error("invalid envelope");
            }
            envelope = parsed as Envelope;
        } catch {
            return this.closeProtocol(socket, "invalid JSON envelope");
        }
        const state = this.states.get(socket);
        if (!state) return;
        if (!state.ready) {
            if (envelope.type !== "hello") return this.closeProtocol(socket, "hello required");
            await this.registerConnection(socket, state, envelope);
            return;
        }
        try {
            await this.handleDeviceMessage(socket, state, envelope);
        } catch (error) {
            this.logger.error(`Device message ${envelope.type} failed`, error);
            this.send(
                socket,
                "error",
                {
                    code: "INTERNAL_ERROR",
                    message: "message processing failed",
                    retryable: true,
                },
                undefined,
                envelope.id,
            );
        }
    }

    private async registerConnection(socket: WebSocket, state: ClientState, envelope: Envelope) {
        const data = envelope.data;
        const deviceId = stringField(data, "device_id")?.toLowerCase();
        const bootId = stringField(data, "boot_id");
        const firmwareVersion = stringField(data, "firmware_version");
        if (
            !deviceId ||
            !bootId ||
            !firmwareVersion ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
                deviceId,
            ) ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(bootId) ||
            !/^[A-Za-z0-9.+-]{1,32}$/.test(firmwareVersion)
        ) {
            return socket.close(4401, "invalid hello");
        }
        let device = await this.deviceRepository.findOne({ where: { deviceId } });
        if (!device) {
            device = this.deviceRepository.create({
                deviceId,
                displayName: `ESP32 ${deviceId.slice(0, 8)}`,
                capabilities: [],
            });
        }

        clearTimeout(state.helloTimer);
        state.ready = true;
        state.deviceId = deviceId;
        state.bootId = bootId;
        state.connectionId = randomUUID();
        const previous = this.clients.get(deviceId);
        if (previous && previous.socket !== socket) previous.socket.close(4000, "replaced");
        this.clients.set(deviceId, { socket, state });

        device.bootId = bootId;
        device.firmwareVersion = firmwareVersion;
        device.lastSeenAt = new Date();
        device.capabilities = Array.isArray(data.capabilities)
            ? data.capabilities.filter((item): item is string => typeof item === "string")
            : [];
        device.limits = this.parseLimits(data.limits);
        device.runtime = isRecord(data.runtime)
            ? {
                  executionModel: stringField(data.runtime, "execution_model") || "main_once",
                  apiVersion: stringField(data.runtime, "api_version") || "xiaozhi.v1",
                  transferStorage: stringField(data.runtime, "transfer_storage") || "ram",
                  maxRunTimeoutMs: numberField(data.runtime, "max_run_timeout_ms") || 60_000,
              }
            : null;
        await this.deviceRepository.save(device);
        await this.connectionRepository.save(
            this.connectionRepository.create({
                connectionId: state.connectionId,
                deviceId,
                bootId,
                remoteAddress: (state as ClientState & { remoteAddress?: string }).remoteAddress,
                connectedAt: new Date(),
            }),
        );
        this.send(
            socket,
            "hello.welcome",
            {
                connection_id: state.connectionId,
                heartbeat_interval_ms: 20_000,
                server_limits: {
                    max_script_bytes: 65_536,
                    max_params_bytes: 4_096,
                    max_chunk_bytes: 1_024,
                    max_message_bytes: MAX_MESSAGE_BYTES,
                },
            },
            undefined,
            envelope.id,
        );
        await this.resumePendingRun(deviceId);
    }

    private async handleDeviceMessage(
        socket: WebSocket,
        state: ClientState,
        envelope: Envelope,
    ) {
        if (!state.deviceId) return;
        switch (envelope.type) {
            case "device.status":
                await this.deviceRepository.update(
                    { deviceId: state.deviceId },
                    { lastSeenAt: new Date() },
                );
                return;
            case "run.ready":
                this.clearPending(state, envelope.reply_to);
                await this.handleRunReady(state.deviceId, envelope);
                return;
            case "run.chunk.ack":
                this.clearPending(state, envelope.reply_to);
                await this.handleChunkAck(state.deviceId, envelope);
                return;
            case "run.accepted":
                this.clearPending(state, envelope.reply_to);
                await this.handleRunAccepted(state.deviceId, envelope);
                return;
            case "run.stopping":
                this.clearPending(state, envelope.reply_to);
                await this.updateRunStatus(state.deviceId, envelope, "stopping");
                return;
            case "run.log":
                await this.handleRunLog(state.deviceId, envelope);
                return;
            case "run.finished":
                await this.handleRunFinished(socket, state.deviceId, envelope);
                return;
            case "error":
                await this.handleDeviceError(state, envelope);
                this.clearPending(state, envelope.reply_to);
                return;
            default:
                this.send(
                    socket,
                    "error",
                    {
                        code: "UNSUPPORTED_MESSAGE",
                        message: `unsupported message type: ${envelope.type}`,
                        retryable: false,
                    },
                    undefined,
                    envelope.id,
                );
        }
    }

    private async handleRunReady(deviceId: string, envelope: Envelope) {
        const run = await this.findDeviceRun(deviceId, stringField(envelope.data, "run_id"));
        if (!run) return;
        const next = numberField(envelope.data, "next_chunk_index");
        const total = Math.ceil(Buffer.byteLength(run.source, "utf8") / run.chunkBytes);
        if (!Number.isInteger(next) || next! < 0 || next! > total) return;
        run.nextChunkIndex = next!;
        run.status = "transferring";
        await this.runRepository.save(run);
        await this.sendNextChunk(run);
    }

    private async handleChunkAck(deviceId: string, envelope: Envelope) {
        const run = await this.findDeviceRun(deviceId, stringField(envelope.data, "run_id"));
        if (!run) return;
        const next = numberField(envelope.data, "next_chunk_index");
        if (!Number.isInteger(next) || next! < run.nextChunkIndex) return;
        run.nextChunkIndex = next!;
        await this.runRepository.save(run);
        await this.sendNextChunk(run);
    }

    private async handleRunAccepted(deviceId: string, envelope: Envelope) {
        const run = await this.findDeviceRun(deviceId, stringField(envelope.data, "run_id"));
        if (!run || TERMINAL_STATUSES.includes(run.status as never)) return;
        run.status = "running";
        run.startedAt ??= new Date();
        run.error = null;
        await this.runRepository.save(run);
    }

    private async updateRunStatus(
        deviceId: string,
        envelope: Envelope,
        status: LuaDeviceRun["status"],
    ) {
        const run = await this.findDeviceRun(deviceId, stringField(envelope.data, "run_id"));
        if (!run || TERMINAL_STATUSES.includes(run.status as never)) return;
        run.status = status;
        await this.runRepository.save(run);
    }

    private async handleRunLog(deviceId: string, envelope: Envelope) {
        const run = await this.findDeviceRun(deviceId, stringField(envelope.data, "run_id"));
        const sequence = numberField(envelope.data, "sequence");
        const level = stringField(envelope.data, "level");
        const text = stringField(envelope.data, "text");
        if (!run || !Number.isInteger(sequence) || sequence! < 1 || !level || !text) return;
        try {
            await this.logRepository.save(
                this.logRepository.create({
                    runId: run.id,
                    sequence: sequence!,
                    level: level.slice(0, 8),
                    text: text.slice(0, 1024),
                }),
            );
        } catch (error) {
            if ((error as { code?: string }).code !== "23505") throw error;
        }
    }

    private async handleRunFinished(socket: WebSocket, deviceId: string, envelope: Envelope) {
        const run = await this.findDeviceRun(deviceId, stringField(envelope.data, "run_id"));
        if (!run) return;
        const status = stringField(envelope.data, "status");
        if (!TERMINAL_STATUSES.includes(status as (typeof TERMINAL_STATUSES)[number])) return;
        if (!TERMINAL_STATUSES.includes(run.status as never)) {
            run.status = status as LuaDeviceRun["status"];
            run.result = envelope.data.result;
            run.error = isRecord(envelope.data.error)
                ? {
                      code: stringField(envelope.data.error, "code") || "LUA_RUNTIME_ERROR",
                      message: stringField(envelope.data.error, "message") || "Lua 运行失败",
                      line: numberField(envelope.data.error, "line"),
                  }
                : null;
            run.finishedAt = new Date();
            await this.runRepository.save(run);
        }
        this.send(socket, "run.finished.ack", { run_id: run.id }, undefined, envelope.id);
        await this.resumePendingRun(deviceId);
    }

    private async handleDeviceError(state: ClientState, envelope: Envelope) {
        if (!envelope.reply_to) return;
        const pending = state.pending.get(envelope.reply_to);
        if (!pending) return;
        const run = await this.findDeviceRun(state.deviceId!, pending.runId);
        if (!run || TERMINAL_STATUSES.includes(run.status as never)) return;
        const retryable = envelope.data.retryable === true;
        run.status = retryable ? "waiting_for_device" : "failed";
        run.error = {
            code: stringField(envelope.data, "code") || "DEVICE_ERROR",
            message: stringField(envelope.data, "message") || "设备拒绝任务",
        };
        if (!retryable) run.finishedAt = new Date();
        await this.runRepository.save(run);
    }

    private async sendPrepare(run: LuaDeviceRun) {
        const client = this.clients.get(run.deviceId);
        if (!client) return;
        const sourceLength = Buffer.byteLength(run.source, "utf8");
        const totalChunks = Math.ceil(sourceLength / run.chunkBytes);
        this.send(
            client,
            "run.prepare",
            {
                run_id: run.id,
                script: {
                    name: run.name,
                    encoding: "utf-8/base64-chunks",
                    byte_length: sourceLength,
                    sha256: run.sourceSha256,
                    chunk_bytes: run.chunkBytes,
                    total_chunks: totalChunks,
                },
                params: run.params,
                params_sha256: run.paramsSha256,
                required_capabilities: run.requiredCapabilities,
                entry: "main",
                timeout_ms: run.timeoutMs,
                run_mode: "replace",
            },
            run.id,
        );
        run.status = "preparing";
        await this.runRepository.save(run);
    }

    private async sendNextChunk(run: LuaDeviceRun) {
        const client = this.clients.get(run.deviceId);
        if (!client) return;
        const source = Buffer.from(run.source, "utf8");
        const totalChunks = Math.ceil(source.length / run.chunkBytes);
        if (run.nextChunkIndex >= totalChunks) {
            this.send(
                client,
                "run.commit",
                { run_id: run.id, byte_length: source.length, sha256: run.sourceSha256 },
                run.id,
            );
            return;
        }
        const offset = run.nextChunkIndex * run.chunkBytes;
        const chunk = source.subarray(offset, Math.min(offset + run.chunkBytes, source.length));
        this.send(
            client,
            "run.chunk",
            {
                run_id: run.id,
                index: run.nextChunkIndex,
                total_chunks: totalChunks,
                offset,
                data_b64: chunk.toString("base64"),
                crc32: calculateLuaChunkCrc32(chunk),
            },
            run.id,
        );
    }

    private async resumePendingRun(deviceId: string) {
        const run = await this.runRepository.findOne({
            where: {
                deviceId,
                status: In([
                    "queued",
                    "preparing",
                    "transferring",
                    "waiting_for_device",
                    "stopping",
                ]),
            },
            order: { createdAt: "ASC" },
        });
        if (!run) return;
        if (run.status === "stopping") {
            const client = this.clients.get(deviceId);
            if (client)
                this.send(client, "run.stop", { run_id: run.id, reason: "user_request" }, run.id);
            return;
        }
        await this.sendPrepare(run);
    }

    private async handleClose(socket: WebSocket, code: number) {
        const state = this.states.get(socket);
        if (!state) return;
        clearTimeout(state.helloTimer);
        if (state.deviceId && this.clients.get(state.deviceId)?.socket === socket) {
            this.clients.delete(state.deviceId);
            await this.runRepository.update(
                { deviceId: state.deviceId, status: In(["preparing", "transferring", "running"]) },
                { status: "waiting_for_device" },
            );
        }
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

    private heartbeat() {
        for (const [deviceId, client] of this.clients) {
            if (!client.state.alive) {
                client.socket.terminate();
                this.clients.delete(deviceId);
                continue;
            }
            client.state.alive = false;
            client.socket.ping();
        }
    }

    private send(
        target: WebSocket | OnlineClient,
        type: string,
        data: Record<string, unknown>,
        runId?: string,
        replyTo?: string,
    ): string {
        const socket = target instanceof WebSocket ? target : target.socket;
        const id = randomUUID();
        const envelope: Envelope = { v: 1, type, id, ts: new Date().toISOString(), data };
        if (replyTo) envelope.reply_to = replyTo;
        const serialized = JSON.stringify(envelope);
        if (runId) {
            const state = this.states.get(socket);
            if (state) {
                const pending: PendingRequest = {
                    runId,
                    type,
                    envelope: serialized,
                    retryCount: 0,
                    chunkIndex: type === "run.chunk" ? numberField(data, "index") : undefined,
                };
                state.pending.set(id, pending);
                if (type === "run.chunk") this.armChunkRetry(socket, id, pending);
            }
            if (state && state.pending.size > 100) {
                const oldest = state.pending.keys().next().value;
                if (oldest) this.clearPending(state, oldest);
            }
        }
        if (socket.readyState === WebSocket.OPEN) socket.send(serialized);
        return id;
    }

    private clearPending(state: ClientState, id?: string) {
        if (!id) return;
        const pending = state.pending.get(id);
        if (!pending) return;
        if (pending.retryTimer) clearTimeout(pending.retryTimer);
        state.pending.delete(id);
    }

    private armChunkRetry(socket: WebSocket, messageId: string, pending: PendingRequest) {
        pending.retryTimer = setTimeout(() => {
            const state = this.states.get(socket);
            const current = state?.pending.get(messageId);
            if (!state || current !== pending || socket.readyState !== WebSocket.OPEN) return;
            if (pending.retryCount >= MAX_CHUNK_RETRIES) {
                this.clearPending(state, messageId);
                void this.markChunkDeliveryWaiting(socket, pending);
                return;
            }
            pending.retryCount += 1;
            socket.send(pending.envelope);
            this.armChunkRetry(socket, messageId, pending);
        }, CHUNK_ACK_TIMEOUT_MS);
        pending.retryTimer.unref();
    }

    private async markChunkDeliveryWaiting(socket: WebSocket, pending: PendingRequest) {
        const state = this.states.get(socket);
        if (!state?.deviceId) return;
        const run = await this.findDeviceRun(state.deviceId, pending.runId);
        if (
            !run ||
            !["preparing", "transferring"].includes(run.status) ||
            (pending.chunkIndex !== undefined && run.nextChunkIndex !== pending.chunkIndex)
        ) {
            return;
        }
        run.status = "waiting_for_device";
        run.error = { code: "CHUNK_ACK_TIMEOUT", message: "设备未确认源码分片" };
        await this.runRepository.save(run);
        socket.terminate();
    }

    private closeProtocol(socket: WebSocket, message: string) {
        this.send(socket, "error", { code: "INVALID_MESSAGE", message, retryable: false });
        socket.close(4400, message.slice(0, 120));
    }

    private async findDeviceRun(deviceId: string, runId?: string) {
        if (!runId) return null;
        return this.runRepository.findOne({ where: { id: runId, deviceId } });
    }

    private async requireDevice(deviceId: string) {
        const device = await this.deviceRepository.findOne({
            where: { deviceId: deviceId.toLowerCase() },
        });
        if (!device) throw HttpErrorFactory.notFound("物理设备不存在");
        return device;
    }

    private async requireOwnedRun(userId: string, deviceId: string, runId: string) {
        const run = await this.runRepository.findOne({
            where: { id: runId, deviceId: deviceId.toLowerCase(), createBy: userId },
        });
        if (!run) throw HttpErrorFactory.notFound("Lua 运行任务不存在");
        return run;
    }

    private serializeDevice(device: LuaPhysicalDevice) {
        return {
            id: device.id,
            deviceId: device.deviceId,
            displayName: device.displayName,
            online: this.clients.has(device.deviceId),
            firmwareVersion: device.firmwareVersion,
            bootId: device.bootId,
            capabilities: device.capabilities,
            limits: device.limits,
            runtime: device.runtime,
            lastSeenAt: device.lastSeenAt,
            createdAt: device.createdAt,
            updatedAt: device.updatedAt,
        };
    }

    private serializeRun(run: LuaDeviceRun) {
        const { source: _source, paramsJson: _paramsJson, ...safe } = run;
        return safe;
    }

    private parseLimits(value: unknown): LuaDeviceLimits | null {
        if (!isRecord(value)) return null;
        return {
            maxScriptBytes: numberField(value, "max_script_bytes") || 65_536,
            maxParamsBytes: numberField(value, "max_params_bytes") || 4_096,
            maxChunkBytes: numberField(value, "max_chunk_bytes") || 1_024,
            maxMessageBytes: numberField(value, "max_message_bytes") || MAX_MESSAGE_BYTES,
            maxLogBytes: numberField(value, "max_log_bytes") || 1_024,
        };
    }

}
