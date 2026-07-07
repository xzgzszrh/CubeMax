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
