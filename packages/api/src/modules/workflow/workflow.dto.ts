import { Type } from "class-transformer";
import { IsInt, IsObject, IsOptional, IsString, Max, Min } from "class-validator";

export class QueryWorkflowDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    pageSize?: number = 20;

    @IsOptional()
    @IsString()
    keyword?: string;
}

export class CreateWorkflowDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsOptional()
    @IsObject()
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
    @IsObject()
    schema?: object;
}
