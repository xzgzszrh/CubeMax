import { IsOptional, IsString } from "class-validator";

export class CreateWorkflowDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsOptional()
    schema?: object;
}

export class UpdateWorkflowDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsOptional()
    schema?: object;
}
