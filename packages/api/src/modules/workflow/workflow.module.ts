import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AiMcpServer, AiMcpTool, AiUserMcpServer, AiWorkflow } from "@buildingai/db/entities";
import { AiMcpModule } from "@modules/ai/mcp/ai-mcp.module";
import { Module } from "@nestjs/common";

import { WorkflowController } from "./workflow.controller";
import { WorkflowEmbeddedExecutorService } from "./workflow-embedded-executor.service";
import { WorkflowMcpExecutorService } from "./workflow-mcp-executor.service";
import { WorkflowRuntimeController } from "./workflow-runtime.controller";
import { WorkflowService } from "./workflow.service";

@Module({
    imports: [
        AiMcpModule,
        TypeOrmModule.forFeature([AiWorkflow, AiMcpServer, AiMcpTool, AiUserMcpServer]),
    ],
    controllers: [WorkflowController, WorkflowRuntimeController],
    providers: [WorkflowService, WorkflowMcpExecutorService, WorkflowEmbeddedExecutorService],
})
export class WorkflowModule {}
