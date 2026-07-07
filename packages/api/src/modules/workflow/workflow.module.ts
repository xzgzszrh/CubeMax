import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AiMcpServer, AiMcpTool, AiUserMcpServer, AiWorkflow } from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { WorkflowController } from "./workflow.controller";
import { WorkflowMcpExecutorService } from "./workflow-mcp-executor.service";
import { WorkflowRuntimeController } from "./workflow-runtime.controller";
import { WorkflowService } from "./workflow.service";

@Module({
    imports: [TypeOrmModule.forFeature([AiWorkflow, AiMcpServer, AiMcpTool, AiUserMcpServer])],
    controllers: [WorkflowController, WorkflowRuntimeController],
    providers: [WorkflowService, WorkflowMcpExecutorService],
})
export class WorkflowModule {}
