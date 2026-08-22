import type { UserPlayground } from "@buildingai/db";
import type {
    TaskCancelOutput,
    TaskReportOutput,
    TaskResultOutput,
    TaskRunOutput,
    TaskValidateOutput,
} from "@flowgram.ai/runtime-interface";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

import { CameraSessionService } from "../mobile/camera-session.service";
import { isMobileCameraEnabled } from "../mobile/is-mobile-camera-enabled";
import {
    assertNoPhoneCameraInsideLoop,
    maxClock,
    schemaHasOpenCameraOnWorkflowStart,
    schemaHasPhoneCamera,
} from "../mobile/phone-camera-schema";
import { ProgrammingProjectService } from "./programming-project.service";
import { WorkflowEmbeddedExecutorService } from "./workflow-embedded-executor.service";
import { WorkflowLlmExecutorService } from "./workflow-llm-executor.service";
import { WorkflowLuaExecutorService } from "./workflow-lua-executor.service";
import { WorkflowMcpExecutorService } from "./workflow-mcp-executor.service";
import { WorkflowPhoneCameraExecutorService } from "./workflow-phone-camera-executor.service";
import { WorkflowSmartHomeExecutorService } from "./workflow-smart-home-executor.service";
import { WorkflowService } from "./workflow.service";
import type {
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

/** Shared server-side execution boundary used by the web API and triggers. */
@Injectable()
export class WorkflowRuntimeExecutionService {
    constructor(
        private readonly workflowMcpExecutorService: WorkflowMcpExecutorService,
        private readonly workflowEmbeddedExecutorService: WorkflowEmbeddedExecutorService,
        private readonly workflowLlmExecutorService: WorkflowLlmExecutorService,
        private readonly workflowLuaExecutorService: WorkflowLuaExecutorService,
        private readonly workflowSmartHomeExecutorService: WorkflowSmartHomeExecutorService,
        private readonly workflowPhoneCameraExecutorService: WorkflowPhoneCameraExecutorService,
        private readonly workflowService: WorkflowService,
        private readonly programmingProjectService: ProgrammingProjectService,
        private readonly cameraSessionService: CameraSessionService,
    ) {}

    private async loadConfiguredRuntime(): Promise<WorkflowRuntimeJsModule> {
        const runtime = await loadRuntimeJs();
        runtime.registerMCPExecutor((input) => this.workflowMcpExecutorService.execute(input));
        runtime.registerLLMExecutor((input) => this.workflowLlmExecutorService.execute(input));
        runtime.registerLuaExecutor((input) => this.workflowLuaExecutorService.execute(input));
        runtime.registerSmartHomeExecutor((input) =>
            this.workflowSmartHomeExecutorService.execute(input),
        );
        runtime.registerPhoneCameraExecutor((input) =>
            this.workflowPhoneCameraExecutorService.execute(input),
        );
        return runtime;
    }

    async validate(
        dto: WorkflowRuntimeTaskDto,
        user: Pick<UserPlayground, "id">,
    ): Promise<TaskValidateOutput> {
        const runtime = await this.loadConfiguredRuntime();
        const taskDto = this.workflowEmbeddedExecutorService.prepareTaskDto(dto);
        return runtime.TaskValidateAPI({
            ...taskDto,
            context: await this.resolveDraftContext(dto, user.id),
        });
    }

    async run(
        dto: WorkflowRuntimeTaskDto,
        user: Pick<UserPlayground, "id">,
        installationId?: string,
    ): Promise<TaskRunOutput> {
        const runtime = await this.loadConfiguredRuntime();
        const taskDto = this.workflowEmbeddedExecutorService.prepareTaskDto(dto);
        const schema = JSON.parse(taskDto.schema) as Record<string, unknown>;
        return this.startCameraAwareRun(runtime, {
            schema,
            inputs: taskDto.inputs,
            context: await this.resolveDraftContext(dto, user.id),
            installationId,
        });
    }

    async runPublished(
        dto: PublishedWorkflowRuntimeTaskDto,
        user: Pick<UserPlayground, "id">,
        installationId?: string,
    ): Promise<TaskRunOutput> {
        const runtime = await this.loadConfiguredRuntime();
        const workflow = await this.workflowService.findOne(dto.workflowId, user.id);
        const projectPublished = workflow.projectId
            ? await this.programmingProjectService.findPublished(workflow.projectId, user.id)
            : undefined;
        const publishedWorkflow = projectPublished
            ? {
                  schema: projectPublished.snapshot.workflow.schema,
                  context: {
                      userId: user.id,
                      projectId: projectPublished.project.id,
                      runtimeTarget: projectPublished.snapshot.runtime.target,
                      simulatorSessionId: projectPublished.snapshot.runtime.simulatorSessionId,
                      deviceId: projectPublished.snapshot.runtime.deviceId,
                      publishedSnapshot: projectPublished.snapshot,
                  },
              }
            : {
                  ...(await this.workflowService.findPublished(dto.workflowId, user.id)),
                  context: { userId: user.id },
              };

        return this.runSchema(
            runtime,
            publishedWorkflow.schema as Record<string, unknown>,
            dto.inputs,
            publishedWorkflow.context,
            installationId,
        );
    }

    /** Execute exactly the published main-flow snapshot of a user-owned project. */
    async runPublishedProject(
        projectId: string,
        user: Pick<UserPlayground, "id">,
        inputs: Record<string, unknown>,
        installationId?: string,
        title?: string,
    ): Promise<TaskRunOutput> {
        const runtime = await this.loadConfiguredRuntime();
        const { project, snapshot } = await this.programmingProjectService.findPublished(
            projectId,
            user.id,
        );
        return this.runSchema(
            runtime,
            snapshot.workflow.schema,
            inputs,
            {
                userId: user.id,
                projectId: project.id,
                runtimeTarget: snapshot.runtime.target,
                simulatorSessionId: snapshot.runtime.simulatorSessionId,
                deviceId: snapshot.runtime.deviceId,
                publishedSnapshot: snapshot,
            },
            installationId,
            title ?? project.name,
        );
    }

    async report(query: WorkflowRuntimeTaskIdDto): Promise<TaskReportOutput> {
        const runtime = await this.loadConfiguredRuntime();
        return runtime.TaskReportAPI(query);
    }

    async result(query: WorkflowRuntimeTaskIdDto): Promise<TaskResultOutput> {
        const runtime = await this.loadConfiguredRuntime();
        return runtime.TaskResultAPI(query);
    }

    async cancel(query: WorkflowRuntimeTaskIdDto): Promise<TaskCancelOutput> {
        const runtime = await this.loadConfiguredRuntime();
        await this.cameraSessionService.closeByTaskId(query.taskID, "workflow_cancelled");
        return runtime.TaskCancelAPI(query);
    }

    private async runSchema(
        runtime: WorkflowRuntimeJsModule,
        schema: Record<string, unknown>,
        inputs: Record<string, unknown>,
        context: Record<string, unknown>,
        installationId?: string,
        title?: string,
    ): Promise<TaskRunOutput> {
        return this.startCameraAwareRun(runtime, {
            schema,
            inputs,
            context,
            installationId,
            title,
        });
    }

    private async startCameraAwareRun(
        runtime: WorkflowRuntimeJsModule,
        params: {
            schema: Record<string, unknown>;
            inputs: Record<string, unknown>;
            context: Record<string, unknown>;
            installationId?: string;
            title?: string;
        },
    ): Promise<TaskRunOutput> {
        const workflowTaskId = randomUUID();
        const context: Record<string, unknown> = {
            ...params.context,
            workflowTaskId,
            installationId: params.installationId,
        };
        const taskDto = this.workflowEmbeddedExecutorService.prepareTaskDto({
            schema: JSON.stringify(params.schema),
            inputs: params.inputs,
        });
        const validation = await runtime.TaskValidateAPI({ ...taskDto, context });
        if (!validation.valid) {
            throw new Error(validation.errors?.join("；") || "工作流输入校验失败");
        }

        let warmed = false;
        if (isMobileCameraEnabled() && schemaHasPhoneCamera(params.schema)) {
            assertNoPhoneCameraInsideLoop(params.schema);
            await this.cameraSessionService.warmup({
                userId: String(context.userId || ""),
                workflowTaskId,
                schema: params.schema,
                installationId: params.installationId,
                title: params.title,
                projectId: typeof context.projectId === "string" ? context.projectId : undefined,
                consentTimeoutMs: maxClock(params.schema, "consentTimeoutMs", 60_000),
                previewMaxMs: maxClock(params.schema, "previewMaxMs", 600_000),
                emitSessionStart: schemaHasOpenCameraOnWorkflowStart(params.schema),
            });
            warmed = true;
        }

        let output: TaskRunOutput;
        try {
            output = await runtime.TaskRunAPI({ ...taskDto, context });
        } catch (error) {
            if (warmed) {
                await this.cameraSessionService.closeByTaskId(workflowTaskId, "task_run_failed");
            }
            throw error;
        }
        const hooked = runtime.onTaskSettled(workflowTaskId, () => {
            void this.cameraSessionService.closeByTaskId(workflowTaskId, "workflow_terminal");
        });
        if (!hooked && warmed) {
            await this.cameraSessionService.closeByTaskId(workflowTaskId, "task_missing");
        }
        return output;
    }

    private async resolveDraftContext(dto: WorkflowRuntimeTaskDto, userId: string) {
        if (!dto.context?.projectId) return { userId };
        const selection = await this.programmingProjectService.getRuntimeSelection(
            dto.context.projectId,
            userId,
        );
        return { userId, ...selection };
    }
}
