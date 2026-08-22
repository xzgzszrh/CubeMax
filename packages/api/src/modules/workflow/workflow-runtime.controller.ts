import type { UserPlayground } from "@buildingai/db";
import { SkipTransform } from "@buildingai/decorators";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import type {
    TaskCancelOutput,
    TaskReportOutput,
    TaskResultOutput,
} from "@flowgram.ai/runtime-interface";
import { Body, Get, Post, Put, Query } from "@nestjs/common";

import {
    PublishedWorkflowRuntimeTaskDto,
    WorkflowRuntimeTaskDto,
    WorkflowRuntimeTaskIdDto,
    WorkflowWaitEventDto,
} from "./workflow-runtime.dto";
import { WorkflowRuntimeExecutionService } from "./workflow-runtime-execution.service";

@SkipTransform()
@WebController("task")
export class WorkflowRuntimeController {
    constructor(private readonly runtimeExecutionService: WorkflowRuntimeExecutionService) {}

    @Post("validate")
    async validate(@Body() dto: WorkflowRuntimeTaskDto, @Playground() user: UserPlayground) {
        return this.runtimeExecutionService.validate(dto, user);
    }

    @Post("run")
    async run(@Body() dto: WorkflowRuntimeTaskDto, @Playground() user: UserPlayground) {
        return this.runtimeExecutionService.run(dto, user);
    }

    @Post("run-published")
    async runPublished(
        @Body() dto: PublishedWorkflowRuntimeTaskDto,
        @Playground() user: UserPlayground,
    ) {
        return this.runtimeExecutionService.runPublished(dto, user);
    }

    @Get("report")
    async report(@Query() query: WorkflowRuntimeTaskIdDto): Promise<TaskReportOutput> {
        return this.runtimeExecutionService.report(query);
    }

    @Get("result")
    async result(@Query() query: WorkflowRuntimeTaskIdDto): Promise<TaskResultOutput> {
        return this.runtimeExecutionService.result(query);
    }

    @Put("cancel")
    async cancel(@Body() dto: WorkflowRuntimeTaskIdDto): Promise<TaskCancelOutput> {
        return this.runtimeExecutionService.cancel(dto);
    }

    @Post("wait-events")
    async waitEvents(@Body() dto: WorkflowWaitEventDto, @Playground() user: UserPlayground) {
        return this.runtimeExecutionService.emitWaitEvent(dto, user);
    }
}
