import type { IncomingMessage, ServerResponse } from "node:http";

export function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
    res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
}

export function getRequestUrl(req: IncomingMessage): URL {
    return new URL(req.url || "/", getBaseUrl(req));
}

export function getBaseUrl(req: IncomingMessage): string {
    const protoHeader = req.headers["x-forwarded-proto"];
    const hostHeader = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || "http";
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;

    return `${proto}://${host || "127.0.0.1"}`;
}

export function getPathParts(url: URL): string[] {
    return url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
}
