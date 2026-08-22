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
import { SmartHomeModule } from "../smart-home/smart-home.module";
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
import { WorkflowWaitExecutorService } from "./workflow-wait-executor.service";
import { WorkflowWaitRegistry } from "./workflow-wait-registry.service";
import { WorkflowDeviceControlExecutorService } from "./workflow-device-control-executor.service";
import { WorkflowSpeechExecutorService } from "./workflow-speech-executor.service";
import { WorkflowVisionExecutorService } from "./workflow-vision-executor.service";
import { WorkflowWebhookExecutorService } from "./workflow-webhook-executor.service";
import { WorkflowRuntimeDeviceService } from "./workflow-runtime-device.service";
import { WorkflowTtsClipService } from "./workflow-tts-clip.service";
import { WorkflowTtsController } from "./workflow-tts.controller";
import { WorkflowSmartHomeExecutorService } from "./workflow-smart-home-executor.service";

@Module({
    imports: [
        AiMcpModule,
        LuaModuleModule,
        LuaDeviceModule,
        OrganizationModule,
        SimulatorModule,
        SmartHomeModule,
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
        WorkflowTtsController,
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
        WorkflowWaitRegistry,
        WorkflowWaitExecutorService,
        WorkflowWebhookExecutorService,
        WorkflowVisionExecutorService,
        WorkflowSpeechExecutorService,
        WorkflowDeviceControlExecutorService,
        WorkflowSmartHomeExecutorService,
        WorkflowRuntimeExecutionService,
        WorkflowRuntimeDeviceService,
        WorkflowTtsClipService,
        SecretService,
    ],
})
export class WorkflowModule {}
