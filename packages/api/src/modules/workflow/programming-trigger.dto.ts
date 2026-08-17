import { Transform, Type } from "class-transformer";
import {
    IsBoolean,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from "class-validator";

export class QueryProgrammingTriggerDto {
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
    pageSize?: number = 50;

    @IsOptional()
    @IsString()
    keyword?: string;

    @IsOptional()
    @Transform(({ value }) =>
        value === true || value === "true"
            ? true
            : value === false || value === "false"
              ? false
              : value,
    )
    @IsBoolean()
    isPinned?: boolean;

    @IsOptional()
    @Transform(({ value }) =>
        value === true || value === "true"
            ? true
            : value === false || value === "false"
              ? false
              : value,
    )
    @IsBoolean()
    isEnabled?: boolean;
}

export class CreateProgrammingTriggerDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: "触发器名称不能为空" })
    @MaxLength(100)
    name: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;

    @IsString()
    @IsNotEmpty({ message: "请选择要绑定的编程工程" })
    projectId: string;

    @IsOptional()
    @IsIn(["form"], { message: "当前仅支持表单触发器" })
    triggerType?: "form";

    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean;

    @IsOptional()
    @IsBoolean()
    isPinned?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(100000)
    homeOrder?: number;
}

export class UpdateProgrammingTriggerDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @IsOptional()
    @IsNotEmpty({ message: "触发器名称不能为空" })
    @MaxLength(100)
    name?: string;

    @IsString()
    @IsOptional()
    @MaxLength(500)
    description?: string;

    @IsString()
    @IsOptional()
    projectId?: string;

    @IsOptional()
    @IsIn(["form"], { message: "当前仅支持表单触发器" })
    triggerType?: "form";

    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean;

    @IsOptional()
    @IsBoolean()
    isPinned?: boolean;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    @Max(100000)
    homeOrder?: number;
}

export class ExecuteProgrammingTriggerDto {
    @IsObject()
    inputs: Record<string, unknown>;
}
