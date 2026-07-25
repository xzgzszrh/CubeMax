import { IsObject, IsString } from "class-validator";

export class WorkflowRuntimeTaskDto {
    @IsString()
    schema: string;

    @IsObject()
    inputs: Record<string, unknown>;

    context?: {
        userId?: string;
    };
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
