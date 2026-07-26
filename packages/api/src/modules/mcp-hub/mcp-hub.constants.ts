/**
 * 内置 MCP Hub 常量与地址工具
 */

/**
 * 读取 Web API 前缀（与 WebController 装饰器的前缀规则保持一致），
 * 返回值形如 "/api"（有前导斜杠、无尾部斜杠）。
 */
export function getWebApiPrefix(): string {
    const prefix = (process.env.VITE_APP_WEB_API_PREFIX || "/api").replace(/^\/+|\/+$/g, "");
    return `/${prefix || "api"}`;
}

/**
 * 本进程内置 hub 的回环基础地址（供进程内消费方按 URL 调用 MCP 端点），
 * 形如 http://127.0.0.1:4090/api/mcp-hub
 */
export function getLocalMcpHubBaseUrl(): string {
    const port = process.env.SERVER_PORT ? Number.parseInt(process.env.SERVER_PORT, 10) : 4090;
    return `http://127.0.0.1:${port}${getWebApiPrefix()}/mcp-hub`;
}
