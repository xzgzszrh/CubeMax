import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Param, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

import { getWebApiPrefix } from "../mcp-hub.constants";
import { McpHubService } from "../services/mcp-hub.service";

/**
 * 内置 MCP Hub 控制器
 *
 * 由独立进程 mcp-server 合并而来，路由与原进程保持同构：
 * - GET  /api/mcp-hub/health              健康检查
 * - GET  /api/mcp-hub/catalog             服务目录（裸 JSON 数组，供注册表嗅探）
 * - GET  /api/mcp-hub/catalog/:serviceKey 单个服务目录项
 * - POST /api/mcp-hub/mcp/:serviceKey     无状态 MCP streamable HTTP 端点
 *
 * 整个控制器免认证（注册表与 MCP 客户端使用裸 fetch，无登录态），
 * 并且全部使用原始响应对象，绕过全局 TransformInterceptor 的响应包装，
 * 保证 /catalog 返回裸数组、MCP 端点返回纯 JSON-RPC 消息体。
 */
@WebController({ path: "mcp-hub", skipAuth: true })
export class McpHubController {
    constructor(private readonly mcpHubService: McpHubService) {}

    @Get("health")
    getHealth(@Res() res: Response) {
        this.sendJson(res, 200, {
            ok: true,
            serviceCount: this.mcpHubService.listServices().length,
            services: this.mcpHubService.getServiceKeys(),
        });
    }

    @Get("catalog")
    getCatalog(@Req() req: Request, @Res() res: Response) {
        this.sendJson(res, 200, this.mcpHubService.createCatalog(this.getHubBaseUrl(req)));
    }

    @Get("catalog/:serviceKey")
    getCatalogItem(
        @Param("serviceKey") serviceKey: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const item = this.mcpHubService
            .createCatalog(this.getHubBaseUrl(req))
            .find((service) => service.key === serviceKey);
        if (!item) {
            this.sendJson(res, 404, {
                error: "未找到 MCP 服务",
                availableServices: this.mcpHubService.getServiceKeys(),
            });
            return;
        }

        this.sendJson(res, 200, item);
    }

    @Post("mcp/:serviceKey")
    async handleMcp(
        @Param("serviceKey") serviceKey: string,
        @Body() body: unknown,
        @Res() res: Response,
    ) {
        try {
            const result = await this.mcpHubService.handleMcpPost(serviceKey, body);
            if (result.body === undefined) {
                res.status(result.status).end();
                return;
            }
            this.sendJson(res, result.status, result.body);
        } catch (error) {
            if (!res.headersSent) {
                this.sendJson(res, 500, {
                    jsonrpc: "2.0",
                    error: {
                        code: -32603,
                        message:
                            error instanceof Error && error.message
                                ? error.message
                                : "服务器内部错误",
                    },
                    id: null,
                });
            }
        }
    }

    /**
     * 无状态模式不提供服务端 SSE 推送流。
     * @ai-sdk/mcp 的 HTTP 客户端连接后会尝试 GET 建立 SSE，收到 405 时按协议静默跳过。
     */
    @Get("mcp/:serviceKey")
    rejectMcpGet(@Res() res: Response) {
        res.status(405).set("allow", "POST").json({ error: "不支持此请求方法，MCP 请求请使用 POST。" });
    }

    /**
     * 无状态模式没有会话可删除；客户端仅在持有会话 ID 时才会发送 DELETE。
     */
    @Delete("mcp/:serviceKey")
    rejectMcpDelete(@Res() res: Response) {
        res.status(405).set("allow", "POST").json({ error: "不支持此请求方法，MCP 请求请使用 POST。" });
    }

    /**
     * 根据请求头推导本 hub 的对外基础地址（用于 catalog 中的服务 URL）。
     * 与原 mcp-server 一致，优先使用反向代理头。
     */
    private getHubBaseUrl(req: Request): string {
        const protoHeader = req.headers["x-forwarded-proto"];
        const hostHeader = req.headers["x-forwarded-host"] || req.headers.host;
        const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || "http";
        const host = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader) || "127.0.0.1";

        return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}${getWebApiPrefix()}/mcp-hub`;
    }

    private sendJson(res: Response, status: number, body: unknown): void {
        res.status(status).set("content-type", "application/json; charset=utf-8").send(
            JSON.stringify(body),
        );
    }
}
