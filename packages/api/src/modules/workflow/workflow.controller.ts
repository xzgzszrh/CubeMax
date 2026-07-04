import { type UserPlayground } from "@buildingai/db";
import { AiWorkflow } from "@buildingai/db/entities";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";

import { CreateWorkflowDto, QueryWorkflowDto, UpdateWorkflowDto } from "./workflow.dto";
import { WorkflowListResult, WorkflowService } from "./workflow.service";

@WebController("workflows")
export class WorkflowController {
    constructor(private readonly workflowService: WorkflowService) {}

    @Get()
    async findAll(
        @Playground() user: UserPlayground,
        @Query() query: QueryWorkflowDto,
    ): Promise<WorkflowListResult> {
        return this.workflowService.findAll(user.id, query);
    }

    @Post()
    async create(
        @Playground() user: UserPlayground,
        @Body() dto: CreateWorkflowDto,
    ): Promise<AiWorkflow> {
        return this.workflowService.create(user.id, dto);
    }

    @Get(":id")
    async findOne(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
    ): Promise<AiWorkflow> {
        return this.workflowService.findOne(id, user.id);
    }

    @Patch(":id")
    async patch(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: UpdateWorkflowDto,
    ): Promise<AiWorkflow> {
        return this.workflowService.update(id, user.id, dto);
    }

    @Put(":id")
    async update(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: UpdateWorkflowDto,
    ): Promise<AiWorkflow> {
        return this.workflowService.update(id, user.id, dto);
    }

    @Delete(":id")
    async remove(@Playground() user: UserPlayground, @Param("id") id: string): Promise<void> {
        await this.workflowService.remove(id, user.id);
    }
}
