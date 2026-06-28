import { type UserPlayground } from "@buildingai/db";
import { AiWorkflow } from "@buildingai/db/entities";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Param, Post, Put } from "@nestjs/common";

import { CreateWorkflowDto, UpdateWorkflowDto } from "./workflow.dto";
import { WorkflowService } from "./workflow.service";

@WebController("workflows")
export class WorkflowController {
    constructor(private readonly workflowService: WorkflowService) {}

    @Get()
    async findAll(@Playground() user: UserPlayground): Promise<AiWorkflow[]> {
        return this.workflowService.findAll(user.id);
    }

    @Post()
    async create(
        @Playground() user: UserPlayground,
        @Body() dto: CreateWorkflowDto,
    ): Promise<AiWorkflow> {
        return this.workflowService.create(user.id, dto);
    }

    @Get(":id")
    async findOne(@Param("id") id: string): Promise<AiWorkflow> {
        return this.workflowService.findOne(id);
    }

    @Put(":id")
    async update(@Param("id") id: string, @Body() dto: UpdateWorkflowDto): Promise<AiWorkflow> {
        return this.workflowService.update(id, dto);
    }

    @Delete(":id")
    async remove(@Param("id") id: string): Promise<void> {
        await this.workflowService.remove(id);
    }
}
