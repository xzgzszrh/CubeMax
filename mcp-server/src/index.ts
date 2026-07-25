import { createServer as createHttpServer } from "node:http";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { createServiceMcpServer } from "./create-server.js";
import { getBaseUrl, getPathParts, getRequestUrl, sendJson } from "./http.js";
import { createMcpCatalog, getMcpService, getMcpServiceKeys, listMcpServices } from "./registry.js";

const port = Number.parseInt(process.env.PORT || "3334", 10);
const host = process.env.HOST || "127.0.0.1";

async function handleMcpRequest(serviceKey: string, req: Parameters<typeof getRequestUrl>[0], res: Parameters<typeof sendJson>[0]) {
    const service = getMcpService(serviceKey);
    if (!service) {
        sendJson(res, 404, {
            error: "未找到 MCP 服务",
            availableServices: getMcpServiceKeys(),
        });
        return;
    }

    if (req.method !== "POST") {
        res.writeHead(405, {
            allow: "POST",
            "content-type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ error: "不支持此请求方法，MCP 请求请使用 POST。" }));
        return;
    }

    const server = createServiceMcpServer(service);
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    });

    const closeResources = () => {
        transport.close().catch(() => undefined);
        server.close().catch(() => undefined);
    };

    try {
        res.on("close", closeResources);
        await server.connect(transport);
        await transport.handleRequest(req, res);
    } catch (error) {
        console.error(`[mcp-server] ${service.key} request failed:`, error);

        if (!res.headersSent) {
            sendJson(res, 500, {
                jsonrpc: "2.0",
                error: {
                    code: -32603,
                    message: "服务器内部错误",
                },
                id: null,
            });
        }
    }
}

const httpServer = createHttpServer((req, res) => {
    const url = getRequestUrl(req);
    const parts = getPathParts(url);

    if (req.method === "GET" && parts.length === 1 && parts[0] === "health") {
        sendJson(res, 200, {
            ok: true,
            serviceCount: listMcpServices().length,
            services: getMcpServiceKeys(),
        });
        return;
    }

    if (req.method === "GET" && parts.length === 1 && parts[0] === "catalog") {
        sendJson(res, 200, createMcpCatalog(getBaseUrl(req)));
        return;
    }

    if (req.method === "GET" && parts.length === 2 && parts[0] === "catalog") {
        const item = createMcpCatalog(getBaseUrl(req)).find((service) => service.key === parts[1]);
        if (!item) {
            sendJson(res, 404, {
                error: "未找到 MCP 服务",
                availableServices: getMcpServiceKeys(),
            });
            return;
        }

        sendJson(res, 200, item);
        return;
    }

    if (parts.length === 2 && parts[0] === "mcp") {
        handleMcpRequest(parts[1] ?? "", req, res).catch((error) => {
            console.error("[mcp-server] unhandled MCP request error:", error);
            if (!res.headersSent) {
                sendJson(res, 500, { error: "服务器内部错误" });
            }
        });
        return;
    }

    sendJson(res, 404, {
        error: "未找到请求的资源",
        routes: ["/health", "/catalog", "/catalog/:serviceKey", "/mcp/:serviceKey"],
    });
});

httpServer.listen(port, host, () => {
    console.log(`[mcp-server] listening on http://${host}:${port}`);
    for (const service of listMcpServices()) {
        console.log(`[mcp-server] ${service.name}: http://${host}:${port}/mcp/${service.key}`);
    }
});

function shutdown(signal: NodeJS.Signals) {
    console.log(`[mcp-server] received ${signal}, shutting down`);
    httpServer.close(() => {
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
