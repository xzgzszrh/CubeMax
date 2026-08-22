import type { UserPlayground } from "@buildingai/db";
import type {
    TaskCancelOutput,
    TaskReportOutput,
    TaskResultOutput,
    TaskRunOutput,
    TaskValidateOutput,
} from "@flowgram.ai/runtime-interface";
import { Injectable } from "@nestjs/common";

import { ProgrammingProjectService } from "./programming-project.service";
import { WorkflowService } from "./workflow.service";
import { WorkflowAgentExecutorService } from "./workflow-agent-executor.service";
import { WorkflowEmbeddedExecutorService } from "./workflow-embedded-executor.service";
import { WorkflowLlmExecutorService } from "./workflow-llm-executor.service";
import { WorkflowLuaExecutorService } from "./workflow-lua-executor.service";
import { WorkflowMcpExecutorService } from "./workflow-mcp-executor.service";
import type {
    PublishedWorkflowRuntimeTaskDto,
    WorkflowRuntimeTaskDto,
    WorkflowRuntimeTaskIdDto,
    WorkflowWaitEventDto,
} from "./workflow-runtime.dto";
import { WorkflowWaitExecutorService } from "./workflow-wait-executor.service";
import { WorkflowWaitRegistry } from "./workflow-wait-registry.service";
import { WorkflowWebhookExecutorService } from "./workflow-webhook-executor.service";

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
        private readonly workflowAgentExecutorService: WorkflowAgentExecutorService,
        private readonly workflowWaitExecutorService: WorkflowWaitExecutorService,
        private readonly workflowWebhookExecutorService: WorkflowWebhookExecutorService,
        private readonly waitRegistry: WorkflowWaitRegistry,
        private readonly workflowService: WorkflowService,
        private readonly programmingProjectService: ProgrammingProjectService,
    ) {}

    private async loadConfiguredRuntime(): Promise<WorkflowRuntimeJsModule> {
        const runtime = await loadRuntimeJs();
        runtime.registerMCPExecutor((input) => this.workflowMcpExecutorService.execute(input));
        runtime.registerLLMExecutor((input) => this.workflowLlmExecutorService.execute(input));
        runtime.registerLuaExecutor((input) => this.workflowLuaExecutorService.execute(input));
        runtime.registerAgentExecutor((input) => this.workflowAgentExecutorService.execute(input));
        runtime.registerWaitExecutor((input) => this.workflowWaitExecutorService.execute(input));
        runtime.registerWebhookExecutor((input) =>
            this.workflowWebhookExecutorService.execute(input),
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
    ): Promise<TaskRunOutput> {
        const runtime = await this.loadConfiguredRuntime();
        const taskDto = this.workflowEmbeddedExecutorService.prepareTaskDto(dto);
        return runtime.TaskRunAPI({
            ...taskDto,
            context: await this.resolveDraftContext(dto, user.id),
        });
    }

    async runPublished(
        dto: PublishedWorkflowRuntimeTaskDto,
        user: Pick<UserPlayground, "id">,
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
                      xiaozhiAgentId: projectPublished.snapshot.runtime.xiaozhiAgentId,
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
        );
    }

    /** Execute exactly the published main-flow snapshot of a user-owned project. */
    async runPublishedProject(
        projectId: string,
        user: Pick<UserPlayground, "id">,
        inputs: Record<string, unknown>,
    ): Promise<TaskRunOutput> {
        const runtime = await this.loadConfiguredRuntime();
        const { project, snapshot } = await this.programmingProjectService.findPublished(
            projectId,
            user.id,
        );
        return this.runSchema(runtime, snapshot.workflow.schema, inputs, {
            userId: user.id,
            projectId: project.id,
            runtimeTarget: snapshot.runtime.target,
            simulatorSessionId: snapshot.runtime.simulatorSessionId,
            deviceId: snapshot.runtime.deviceId,
            xiaozhiAgentId: snapshot.runtime.xiaozhiAgentId,
            publishedSnapshot: snapshot,
        });
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
        return runtime.TaskCancelAPI(query);
    }

    async emitWaitEvent(
        dto: WorkflowWaitEventDto,
        user: Pick<UserPlayground, "id">,
    ): Promise<{ resumed: number }> {
        if (dto.projectId) {
            await this.programmingProjectService.findOne(dto.projectId, user.id);
        }
        const resumed = this.waitRegistry.emit({
            triggerId: dto.triggerId.trim(),
            projectId: dto.projectId,
            data: dto.data ?? {},
        });
        return { resumed };
    }

    private async runSchema(
        runtime: WorkflowRuntimeJsModule,
        schema: Record<string, unknown>,
        inputs: Record<string, unknown>,
        context: Record<string, unknown>,
    ): Promise<TaskRunOutput> {
        const taskDto = this.workflowEmbeddedExecutorService.prepareTaskDto({
            schema: JSON.stringify(schema),
            inputs,
        });
        const validation = await runtime.TaskValidateAPI({ ...taskDto, context });
        if (!validation.valid) {
            throw new Error(validation.errors?.join("；") || "工作流输入校验失败");
        }
        return runtime.TaskRunAPI({ ...taskDto, context });
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
