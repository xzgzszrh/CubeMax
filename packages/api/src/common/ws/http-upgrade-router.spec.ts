import { HttpUpgradeRouter } from "./http-upgrade-router";

describe("HttpUpgradeRouter", () => {
    it("destroys unknown paths and does not call other handlers", () => {
        const listeners = new Map<string, Function>();
        const httpServer = {
            on: (event: string, handler: Function) => listeners.set(event, handler),
            off: (event: string) => listeners.delete(event),
        };
        const router = new HttpUpgradeRouter({
            httpAdapter: { getHttpServer: () => httpServer },
        } as never);

        const lua = jest.fn();
        const mobile = jest.fn();
        router.register("/api/device-ws/v1", lua);
        router.register("/api/mobile-ws/v1", mobile);

        const upgrade = listeners.get("upgrade");
        expect(upgrade).toBeDefined();

        const destroy = jest.fn();
        upgrade?.(
            { url: "/api/no-such-ws", socket: { destroy } },
            { destroy },
            Buffer.alloc(0),
        );
        expect(destroy).toHaveBeenCalled();
        expect(lua).not.toHaveBeenCalled();
        expect(mobile).not.toHaveBeenCalled();

        const socket = { destroy: jest.fn() };
        upgrade?.({ url: "/api/mobile-ws/v1" }, socket, Buffer.from("x"));
        expect(mobile).toHaveBeenCalledTimes(1);
        expect(lua).not.toHaveBeenCalled();
        expect(socket.destroy).not.toHaveBeenCalled();
    });

    it("destroys sockets when the URL cannot be parsed", () => {
        const listeners = new Map<string, Function>();
        const httpServer = {
            on: (event: string, handler: Function) => listeners.set(event, handler),
            off: () => undefined,
        };
        const router = new HttpUpgradeRouter({
            httpAdapter: { getHttpServer: () => httpServer },
        } as never);
        router.register("/api/device-ws/v1", jest.fn());
        const destroy = jest.fn();
        listeners.get("upgrade")?.({ url: "http://[::1" }, { destroy }, Buffer.alloc(0));
        expect(destroy).toHaveBeenCalled();
    });
});
