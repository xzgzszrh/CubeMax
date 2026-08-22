import { SecretService } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    AiMcpServer,
    AiMcpTool,
    AiModel,
    AiProvider,
    AiUserMcpServer,
    AiWorkflow,
    LuaModule,
    ProgrammingProject,
    ProgrammingProjectTool,
    ProgrammingTrigger,
    Secret,
    SecretTemplate,
} from "@buildingai/db/entities";
import { AiMcpModule } from "@modules/ai/mcp/ai-mcp.module";
import { LuaModuleModule } from "@modules/lua/lua.module";
import { LuaDeviceModule } from "@modules/lua-device/lua-device.module";
import { Module } from "@nestjs/common";

import { OrganizationModule } from "../organization/organization.module";
import { SimulatorModule } from "../simulator/simulator.module";
import { ProgrammingProjectController } from "./programming-project.controller";
import { ProgrammingProjectService } from "./programming-project.service";
import { ProgrammingTriggerController } from "./programming-trigger.controller";
import { ProgrammingTriggerService } from "./programming-trigger.service";
import { WorkflowController } from "./workflow.controller";
import { WorkflowService } from "./workflow.service";
import { WorkflowAgentExecutorService } from "./workflow-agent-executor.service";
import { WorkflowEmbeddedExecutorService } from "./workflow-embedded-executor.service";
import { WorkflowLlmExecutorService } from "./workflow-llm-executor.service";
import { WorkflowLuaExecutorService } from "./workflow-lua-executor.service";
import { WorkflowMcpExecutorService } from "./workflow-mcp-executor.service";
import { WorkflowRuntimeController } from "./workflow-runtime.controller";
import { WorkflowRuntimeExecutionService } from "./workflow-runtime-execution.service";

@Module({
    imports: [
        AiMcpModule,
        LuaModuleModule,
        LuaDeviceModule,
        OrganizationModule,
        SimulatorModule,
        TypeOrmModule.forFeature([
            AiWorkflow,
            ProgrammingProject,
            ProgrammingProjectTool,
            ProgrammingTrigger,
            LuaModule,
            AiMcpServer,
            AiMcpTool,
            AiUserMcpServer,
            AiModel,
            AiProvider,
            Secret,
            SecretTemplate,
        ]),
    ],
    controllers: [
        WorkflowController,
        ProgrammingProjectController,
        ProgrammingTriggerController,
        WorkflowRuntimeController,
    ],
    providers: [
        WorkflowService,
        ProgrammingProjectService,
        ProgrammingTriggerService,
        WorkflowMcpExecutorService,
        WorkflowEmbeddedExecutorService,
        WorkflowLlmExecutorService,
        WorkflowLuaExecutorService,
        WorkflowAgentExecutorService,
        WorkflowRuntimeExecutionService,
        SecretService,
    ],
})
export class WorkflowModule {}
