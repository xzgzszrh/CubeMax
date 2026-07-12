import { Transform, Type } from "class-transformer";
import {
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from "class-validator";

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
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: "工作流名称不能为空" })
    @MaxLength(100, { message: "工作流名称不能超过100个字符" })
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsOptional()
    @IsObject()
    schema?: object;
}

export class UpdateWorkflowDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: "工作流名称不能为空" })
    @MaxLength(100, { message: "工作流名称不能超过100个字符" })
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsOptional()
    @IsObject()
    schema?: object;
}
