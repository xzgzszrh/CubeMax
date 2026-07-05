import { SkipTransform } from "@buildingai/decorators";
import type {
    TaskCancelOutput,
    TaskReportOutput,
    TaskResultOutput,
    TaskRunOutput,
    TaskValidateOutput,
} from "@flowgram.ai/runtime-interface";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Get, Post, Put, Query } from "@nestjs/common";

import { WorkflowRuntimeTaskDto, WorkflowRuntimeTaskIdDto } from "./workflow-runtime.dto";

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
    @Post("validate")
    async validate(@Body() dto: WorkflowRuntimeTaskDto): Promise<TaskValidateOutput> {
        const { TaskValidateAPI } = await loadRuntimeJs();
        return TaskValidateAPI(dto);
    }

    @Post("run")
    async run(@Body() dto: WorkflowRuntimeTaskDto): Promise<TaskRunOutput> {
        const { TaskRunAPI } = await loadRuntimeJs();
        return TaskRunAPI(dto);
    }

    @Get("report")
    async report(@Query() query: WorkflowRuntimeTaskIdDto): Promise<TaskReportOutput> {
        const { TaskReportAPI } = await loadRuntimeJs();
        return TaskReportAPI(query);
    }

    @Get("result")
    async result(@Query() query: WorkflowRuntimeTaskIdDto): Promise<TaskResultOutput> {
        const { TaskResultAPI } = await loadRuntimeJs();
        return TaskResultAPI(query);
    }

    @Put("cancel")
    async cancel(@Body() dto: WorkflowRuntimeTaskIdDto): Promise<TaskCancelOutput> {
        const { TaskCancelAPI } = await loadRuntimeJs();
        return TaskCancelAPI(dto);
    }
}
