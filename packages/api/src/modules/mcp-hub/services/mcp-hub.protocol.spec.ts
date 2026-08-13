import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { createMcpClient, type McpClient } from "@buildingai/ai-sdk";

import { SimulatorService } from "../../simulator/simulator.service";
import { McpHubService } from "./mcp-hub.service";

jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: {
        badRequest: (message: string) => new Error(message),
        notFound: (message: string) => new Error(message),
    },
}));

/**
 * 协议兼容性测试：用真实的 @ai-sdk/mcp streamable HTTP 客户端
 * （与 builtin-mcp-registry / 工作流 / 小智网关使用的完全相同）
 * 连接包装了 McpHubService 的 HTTP 服务器，验证握手、工具发现与调用。
 */
describe("McpHubService streamable HTTP 协议兼容性", () => {
    let hub: McpHubService;
    let server: Server;
    let baseUrl: string;
    const clients: McpClient[] = [];

    beforeAll(async () => {
        hub = new McpHubService(new SimulatorService());

        // 模拟控制器行为的最小 HTTP 包装：POST 转交协议处理器，GET/DELETE 返回 405
        server = createServer((req, res) => {
            const match = /^\/mcp\/([^/?]+)/.exec(req.url || "");
            const serviceKey = match ? decodeURIComponent(match[1]) : "";

            if (req.method !== "POST") {
                res.writeHead(405, { allow: "POST" });
                res.end();
                return;
            }

            let raw = "";
            req.on("data", (chunk) => (raw += chunk));
            req.on("end", () => {
                void (async () => {
                    let payload: unknown;
                    try {
                        payload = JSON.parse(raw || "null");
                    } catch {
                        payload = undefined;
                    }
                    const result = await hub.handleMcpPost(serviceKey, payload);
                    if (result.body === undefined) {
                        res.writeHead(result.status);
                        res.end();
                        return;
                    }
                    res.writeHead(result.status, {
                        "content-type": "application/json; charset=utf-8",
                    });
                    res.end(JSON.stringify(result.body));
                })();
            });
        });

        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
        for (const client of clients) {
            await client.close().catch(() => undefined);
        }
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    async function connect(serviceKey: string): Promise<McpClient> {
        const client = await createMcpClient({
            transport: { type: "http", url: `${baseUrl}/mcp/${serviceKey}` },
            name: serviceKey,
        });
        clients.push(client);
        return client;
    }

    it("完成 initialize 握手并列出计算器工具", async () => {
        const client = await connect("calculator");
        const tools = await client.listTools();

        expect(tools.map((tool) => tool.name).sort()).toEqual(["add", "multiply"]);
        const add = tools.find((tool) => tool.name === "add");
        expect(add?.inputSchema).toMatchObject({ type: "object", required: ["a", "b"] });
    });

    it("通过客户端调用 add 工具得到正确结果", async () => {
        const client = await connect("calculator");
        const result = (await client.callTool("add", { a: 20, b: 22 })) as {
            content: Array<{ type: string; text: string }>;
        };

        expect(result.content[0].text).toBe("20 + 22 = 42");
    });

    it("嵌入式服务可发现全部占位工具", async () => {
        const client = await connect("embedded");
        const tools = await client.listTools();

        expect(tools.length).toBeGreaterThanOrEqual(20);
        expect(tools.map((tool) => tool.name)).toEqual(
            expect.arrayContaining(["scan_serial_ports", "gpio_write", "i2c_scan"]),
        );
    });
});
