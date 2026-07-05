import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AiWorkflow } from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { WorkflowController } from "./workflow.controller";
import { WorkflowRuntimeController } from "./workflow-runtime.controller";
import { WorkflowService } from "./workflow.service";

@Module({
    imports: [TypeOrmModule.forFeature([AiWorkflow])],
    controllers: [WorkflowController, WorkflowRuntimeController],
    providers: [WorkflowService],
})
export class WorkflowModule {}
