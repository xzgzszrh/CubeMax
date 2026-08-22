import { Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";

export type HttpUpgradeHandler = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
) => void;

/**
 * Single `http.Server` `'upgrade'` listener shared by Lua and Mobile gateways.
 * The first `register()` attaches the listener; later registers only add paths.
 */
@Injectable()
export class HttpUpgradeRouter implements OnApplicationShutdown {
    private readonly logger = new Logger(HttpUpgradeRouter.name);
    private readonly handlers = new Map<string, HttpUpgradeHandler>();
    private attached = false;
    private httpServer?: { on: Function; off: Function };

    constructor(private readonly adapterHost: HttpAdapterHost) {}

    register(pathname: string, handler: HttpUpgradeHandler): void {
        this.handlers.set(pathname, handler);
        this.ensureAttached();
        this.logger.log(`WebSocket upgrade registered at ${pathname}`);
    }

    onApplicationShutdown(): void {
        if (this.attached) {
            this.httpServer?.off("upgrade", this.handleUpgrade);
            this.attached = false;
        }
        this.handlers.clear();
    }

    private ensureAttached(): void {
        if (this.attached) return;
        this.httpServer = this.adapterHost.httpAdapter.getHttpServer();
        this.httpServer.on("upgrade", this.handleUpgrade);
        this.attached = true;
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
        const handler = this.handlers.get(pathname);
        if (!handler) {
            socket.destroy();
            return;
        }
        handler(request, socket, head);
    };
}
