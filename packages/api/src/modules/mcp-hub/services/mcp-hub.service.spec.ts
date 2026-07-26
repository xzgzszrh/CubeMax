import { McpHubService } from "./mcp-hub.service";

/**
 * 内置 MCP Hub 无状态 streamable HTTP 协议处理器的纯逻辑测试（不依赖数据库）
 */
describe("McpHubService", () => {
    let service: McpHubService;

    beforeEach(() => {
        service = new McpHubService();
    });

    const request = (method: string, params?: Record<string, unknown>, id: number | string = 1) => ({
        jsonrpc: "2.0",
        id,
        method,
        ...(params ? { params } : {}),
    });

    describe("catalog", () => {
        it("包含计算器、文本、嵌入式三个基础服务", () => {
            const keys = service.getServiceKeys();
            expect(keys).toEqual(expect.arrayContaining(["calculator", "text", "embedded"]));
        });

        it("目录项的 URL 基于传入的 baseUrl 拼接", () => {
            const catalog = service.createCatalog("http://127.0.0.1:4090/api/mcp-hub");
            const calculator = catalog.find((item) => item.key === "calculator");
            expect(calculator?.url).toBe("http://127.0.0.1:4090/api/mcp-hub/mcp/calculator");
            expect(calculator?.tools.map((tool) => tool.name)).toEqual(["add", "multiply"]);
        });
    });

    describe("initialize", () => {
        it("回显客户端受支持的协议版本", async () => {
            const result = await service.handleMcpPost(
                "calculator",
                request("initialize", {
                    protocolVersion: "2025-03-26",
                    capabilities: {},
                    clientInfo: { name: "test", version: "1.0.0" },
                }),
            );

            expect(result.status).toBe(200);
            expect(result.body).toMatchObject({
                jsonrpc: "2.0",
                id: 1,
                result: {
                    protocolVersion: "2025-03-26",
                    capabilities: { tools: {} },
                    serverInfo: { name: "buildingai-calculator" },
                },
            });
        });

        it("客户端请求未知版本时回落到最新版本", async () => {
            const result = await service.handleMcpPost(
                "calculator",
                request("initialize", { protocolVersion: "1999-01-01" }),
            );

            expect((result.body as any).result.protocolVersion).toBe("2025-06-18");
        });
    });

    describe("notifications 与 ping", () => {
        it("notifications/initialized 返回 202 且无响应体", async () => {
            const result = await service.handleMcpPost("calculator", {
                jsonrpc: "2.0",
                method: "notifications/initialized",
            });

            expect(result.status).toBe(202);
            expect(result.body).toBeUndefined();
        });

        it("ping 返回空 result", async () => {
            const result = await service.handleMcpPost("calculator", request("ping"));
            expect(result.body).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
        });
    });

    describe("tools/list", () => {
        it("返回带 inputSchema 与 outputSchema 的工具列表", async () => {
            const result = await service.handleMcpPost("calculator", request("tools/list"));
            const tools = (result.body as any).result.tools;

            expect(tools).toHaveLength(2);
            const add = tools.find((tool: any) => tool.name === "add");
            expect(add.inputSchema.required).toEqual(["a", "b"]);
            expect(add.outputSchema.required).toEqual(["result", "text"]);
        });
    });

    describe("tools/call", () => {
        it("执行 add 工具并返回结构化结果", async () => {
            const result = await service.handleMcpPost(
                "calculator",
                request("tools/call", { name: "add", arguments: { a: 2, b: 3 } }),
            );

            expect((result.body as any).result).toEqual({
                content: [{ type: "text", text: "2 + 3 = 5" }],
                structuredContent: { result: 5, text: "2 + 3 = 5" },
            });
        });

        it("参数非法时返回 isError 结果而非 JSON-RPC 错误", async () => {
            const result = await service.handleMcpPost(
                "calculator",
                request("tools/call", { name: "add", arguments: { a: "x", b: 3 } }),
            );

            const body = result.body as any;
            expect(result.status).toBe(200);
            expect(body.result.isError).toBe(true);
            expect(body.result.content[0].text).toContain("a");
        });

        it("未知工具返回 isError 结果", async () => {
            const result = await service.handleMcpPost(
                "calculator",
                request("tools/call", { name: "nope", arguments: {} }),
            );

            expect((result.body as any).result.isError).toBe(true);
        });

        it("嵌入式占位工具返回 notImplemented 标记", async () => {
            const result = await service.handleMcpPost(
                "embedded",
                request("tools/call", {
                    name: "gpio_write",
                    arguments: { sessionId: "s1", pin: "D1", value: true },
                }),
            );

            expect((result.body as any).result.structuredContent).toMatchObject({
                ok: false,
                notImplemented: true,
                tool: "gpio_write",
            });
        });
    });

    describe("错误处理", () => {
        it("未知服务返回 404", async () => {
            const result = await service.handleMcpPost("nope", request("ping"));
            expect(result.status).toBe(404);
        });

        it("未知方法返回 -32601", async () => {
            const result = await service.handleMcpPost("calculator", request("resources/list"));
            expect((result.body as any).error.code).toBe(-32601);
        });

        it("非 JSON-RPC 消息返回 -32600", async () => {
            const result = await service.handleMcpPost("calculator", { hello: "world" });
            expect((result.body as any).error.code).toBe(-32600);
        });

        it("批量消息只返回请求消息的响应", async () => {
            const result = await service.handleMcpPost("calculator", [
                { jsonrpc: "2.0", method: "notifications/initialized" },
                request("ping", undefined, 7),
            ]);

            expect(result.status).toBe(200);
            expect(result.body).toEqual([{ jsonrpc: "2.0", id: 7, result: {} }]);
        });
    });
});
