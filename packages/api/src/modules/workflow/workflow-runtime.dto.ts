import { IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class WorkflowRuntimeContextDto {
    @IsOptional()
    @IsString()
    projectId?: string;

    @IsOptional()
    @IsIn(["local", "simulator", "device"])
    runtimeTarget?: "local" | "simulator" | "device";

    @IsOptional()
    @IsString()
    simulatorSessionId?: string;

    @IsOptional()
    @IsString()
    deviceId?: string;

    @IsOptional()
    @IsString()
    xiaozhiAgentId?: string;
}

export class WorkflowRuntimeTaskDto {
    @IsString()
    schema: string;

    @IsObject()
    inputs: Record<string, unknown>;

    @IsOptional()
    @IsObject()
    context?: WorkflowRuntimeContextDto;
}

export class WorkflowRuntimeTaskIdDto {
    @IsString()
    taskID: string;
}

export class PublishedWorkflowRuntimeTaskDto {
    @IsString()
    workflowId: string;

    @IsObject()
    inputs: Record<string, unknown>;
}
