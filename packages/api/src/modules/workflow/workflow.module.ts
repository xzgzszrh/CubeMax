import { SecretService } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    AiMcpServer,
    AiMcpTool,
    AiModel,
    AiProvider,
    AiUserMcpServer,
    AiWorkflow,
    Secret,
    SecretTemplate,
} from "@buildingai/db/entities";
import { AiMcpModule } from "@modules/ai/mcp/ai-mcp.module";
import { Module } from "@nestjs/common";

import { WorkflowController } from "./workflow.controller";
import { WorkflowService } from "./workflow.service";
import { WorkflowEmbeddedExecutorService } from "./workflow-embedded-executor.service";
import { WorkflowLlmExecutorService } from "./workflow-llm-executor.service";
import { WorkflowMcpExecutorService } from "./workflow-mcp-executor.service";
import { WorkflowRuntimeController } from "./workflow-runtime.controller";

@Module({
    imports: [
        AiMcpModule,
        TypeOrmModule.forFeature([
            AiWorkflow,
            AiMcpServer,
            AiMcpTool,
            AiUserMcpServer,
            AiModel,
            AiProvider,
            Secret,
            SecretTemplate,
        ]),
    ],
    controllers: [WorkflowController, WorkflowRuntimeController],
    providers: [
        WorkflowService,
        WorkflowMcpExecutorService,
        WorkflowEmbeddedExecutorService,
        WorkflowLlmExecutorService,
        SecretService,
    ],
})
export class WorkflowModule {}
