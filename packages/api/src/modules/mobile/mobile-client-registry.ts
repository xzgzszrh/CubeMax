import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { WebSocket } from "ws";

import { MOBILE_CAPTURE_ACK_TIMEOUT_MS, MOBILE_CAPTURE_MAX_RETRIES, type MobileEnvelope } from "./mobile-protocol";

type PendingCommand = {
    envelope: string;
    retryCount: number;
    retryTimer?: NodeJS.Timeout;
};

export type MobileOnlineClient = {
    socket: WebSocket;
    userId: string;
    installationId: string;
    pending: Map<string, PendingCommand>;
};

@Injectable()
export class MobileClientRegistry {
    private readonly clients = new Map<string, MobileOnlineClient>();

    key(userId: string, installationId: string): string {
        return `${userId}:${installationId}`;
    }

    isOnline(userId: string, installationId: string): boolean {
        const client = this.clients.get(this.key(userId, installationId));
        return !!client && client.socket.readyState === WebSocket.OPEN;
    }

    set(client: MobileOnlineClient): MobileOnlineClient | undefined {
        const key = this.key(client.userId, client.installationId);
        const previous = this.clients.get(key);
        this.clients.set(key, client);
        return previous && previous.socket !== client.socket ? previous : undefined;
    }

    get(userId: string, installationId: string): MobileOnlineClient | undefined {
        return this.clients.get(this.key(userId, installationId));
    }

    deleteIf(socket: WebSocket, userId?: string, installationId?: string): void {
        if (!userId || !installationId) return;
        const key = this.key(userId, installationId);
        if (this.clients.get(key)?.socket === socket) this.clients.delete(key);
    }

    entries(): IterableIterator<[string, MobileOnlineClient]> {
        return this.clients.entries();
    }

    forUser(userId: string): MobileOnlineClient[] {
        const prefix = `${userId}:`;
        return [...this.clients.values()].filter((client) => client.userId === userId || this.key(client.userId, client.installationId).startsWith(prefix));
    }

    send(
        userId: string,
        installationId: string,
        type: string,
        data: Record<string, unknown>,
        replyTo?: string,
        track = false,
    ): string | null {
        const client = this.get(userId, installationId);
        if (!client || client.socket.readyState !== WebSocket.OPEN) return null;
        const id = randomUUID();
        const envelope: MobileEnvelope = { v: 1, type, id, ts: new Date().toISOString(), data };
        if (replyTo) envelope.reply_to = replyTo;
        const serialized = JSON.stringify(envelope);
        if (track) {
            client.pending.set(id, { envelope: serialized, retryCount: 0 });
        }
        client.socket.send(serialized);
        return id;
    }

    armCaptureRetry(userId: string, installationId: string, messageId: string): void {
        const client = this.get(userId, installationId);
        const pending = client?.pending.get(messageId);
        if (!client || !pending) return;
        this.scheduleRetry(client, messageId, pending);
    }

    clearPending(userId: string, installationId: string, messageId?: string): void {
        const client = this.get(userId, installationId);
        if (!client || !messageId) return;
        const pending = client.pending.get(messageId);
        if (!pending) return;
        if (pending.retryTimer) clearTimeout(pending.retryTimer);
        client.pending.delete(messageId);
    }

    closeUser(userId: string, code: number, reason: string): void {
        for (const client of this.forUser(userId)) {
            client.socket.close(code, reason.slice(0, 120));
        }
    }

    private scheduleRetry(client: MobileOnlineClient, messageId: string, pending: PendingCommand): void {
        pending.retryTimer = setTimeout(() => {
            const current = client.pending.get(messageId);
            if (current !== pending || client.socket.readyState !== WebSocket.OPEN) return;
            if (pending.retryCount >= MOBILE_CAPTURE_MAX_RETRIES) {
                if (pending.retryTimer) clearTimeout(pending.retryTimer);
                client.pending.delete(messageId);
                return;
            }
            pending.retryCount += 1;
            client.socket.send(pending.envelope);
            this.scheduleRetry(client, messageId, pending);
        }, MOBILE_CAPTURE_ACK_TIMEOUT_MS);
        pending.retryTimer.unref();
    }
}
