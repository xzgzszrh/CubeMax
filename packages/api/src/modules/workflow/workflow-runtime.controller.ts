import type { UserPlayground } from "@buildingai/db";
import { SkipTransform } from "@buildingai/decorators";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { HttpErrorFactory } from "@buildingai/errors";
import { WebController } from "@common/decorators/controller.decorator";
import type {
    TaskCancelOutput,
    TaskReportOutput,
    TaskResultOutput,
    TaskRunOutput,
    TaskValidateOutput,
} from "@flowgram.ai/runtime-interface";
import { Body, Get, Post, Put, Query } from "@nestjs/common";

import { WorkflowService } from "./workflow.service";
import { WorkflowEmbeddedExecutorService } from "./workflow-embedded-executor.service";
import { WorkflowLlmExecutorService } from "./workflow-llm-executor.service";
import { WorkflowLuaExecutorService } from "./workflow-lua-executor.service";
import { WorkflowMcpExecutorService } from "./workflow-mcp-executor.service";
import {
    PublishedWorkflowRuntimeTaskDto,
    WorkflowRuntimeTaskDto,
    WorkflowRuntimeTaskIdDto,
} from "./workflow-runtime.dto";

type WorkflowRuntimeJsModule = typeof import("@flowgram.ai/runtime-js");

let runtimeJsModulePromise: Promise<WorkflowRuntimeJsModule> | undefined;

function loadRuntimeJs(): Promise<WorkflowRuntimeJsModule> {
    runtimeJsModulePromise ??= new Function(
        "return import('@flowgram.ai/runtime-js')",
    )() as Promise<WorkflowRuntimeJsModule>;
    return runtimeJsModulePromise;
}

@SkipTransform()
@WebController("task")
export class WorkflowRuntimeController {
    constructor(
        private readonly workflowMcpExecutorService: WorkflowMcpExecutorService,
        private readonly workflowEmbeddedExecutorService: WorkflowEmbeddedExecutorService,
        private readonly workflowLlmExecutorService: WorkflowLlmExecutorService,
        private readonly workflowLuaExecutorService: WorkflowLuaExecutorService,
        private readonly workflowService: WorkflowService,
    ) {}

    private async loadConfiguredRuntime(): Promise<WorkflowRuntimeJsModule> {
        const runtime = await loadRuntimeJs();
        runtime.registerMCPExecutor((input) => this.workflowMcpExecutorService.execute(input));
        runtime.registerLLMExecutor((input) => this.workflowLlmExecutorService.execute(input));
        runtime.registerLuaExecutor((input) => this.workflowLuaExecutorService.execute(input));
        return runtime;
    }

    @Post("validate")
    async validate(
        @Body() dto: WorkflowRuntimeTaskDto,
        @Playground() user: UserPlayground,
    ): Promise<TaskValidateOutput> {
        const { TaskValidateAPI } = await this.loadConfiguredRuntime();
        const taskDto = this.workflowEmbeddedExecutorService.prepareTaskDto(dto);
        return TaskValidateAPI({
            ...taskDto,
            context: {
                userId: user.id,
            },
        });
    }

    @Post("run")
    async run(
        @Body() dto: WorkflowRuntimeTaskDto,
        @Playground() user: UserPlayground,
    ): Promise<TaskRunOutput> {
        const { TaskRunAPI } = await this.loadConfiguredRuntime();
        const taskDto = this.workflowEmbeddedExecutorService.prepareTaskDto(dto);
        return TaskRunAPI({
            ...taskDto,
            context: {
                userId: user.id,
            },
        });
    }

    @Post("run-published")
    async runPublished(
        @Body() dto: PublishedWorkflowRuntimeTaskDto,
        @Playground() user: UserPlayground,
    ): Promise<TaskRunOutput> {
        const publishedWorkflow = await this.workflowService.findPublished(dto.workflowId, user.id);
        const runtime = await this.loadConfiguredRuntime();
        const taskDto = this.workflowEmbeddedExecutorService.prepareTaskDto({
            schema: JSON.stringify(publishedWorkflow.schema),
            inputs: dto.inputs,
        });
        const context = { userId: user.id };
        const validation = await runtime.TaskValidateAPI({ ...taskDto, context });
        if (!validation.valid) {
            throw HttpErrorFactory.badRequest(
                validation.errors?.join("；") || "工作流输入校验失败",
            );
        }

        return runtime.TaskRunAPI({ ...taskDto, context });
    }

    @Get("report")
    async report(@Query() query: WorkflowRuntimeTaskIdDto): Promise<TaskReportOutput> {
        const { TaskReportAPI } = await this.loadConfiguredRuntime();
        return TaskReportAPI(query);
    }

    @Get("result")
    async result(@Query() query: WorkflowRuntimeTaskIdDto): Promise<TaskResultOutput> {
        const { TaskResultAPI } = await this.loadConfiguredRuntime();
        return TaskResultAPI(query);
    }

    @Put("cancel")
    async cancel(@Body() dto: WorkflowRuntimeTaskIdDto): Promise<TaskCancelOutput> {
        const { TaskCancelAPI } = await this.loadConfiguredRuntime();
        return TaskCancelAPI(dto);
    }
}
