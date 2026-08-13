import { Module } from "@nestjs/common";

import { SimulatorModule } from "../simulator/simulator.module";
import { McpHubController } from "./controllers/mcp-hub.controller";
import { McpHubService } from "./services/mcp-hub.service";

/**
 * 内置 MCP Hub 模块
 *
 * 原独立进程 mcp-server 合并进主后端后的宿主模块：
 * 对外暴露免认证的 /api/mcp-hub/catalog 与 /api/mcp-hub/mcp/:serviceKey 端点，
 * 并导出 McpHubService 供内置 MCP 注册表进程内直读服务目录。
 */
@Module({
    imports: [SimulatorModule],
    controllers: [McpHubController],
    providers: [McpHubService],
    exports: [McpHubService],
})
export class McpHubModule {}
