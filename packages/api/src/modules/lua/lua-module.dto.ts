import { Transform, Type } from "class-transformer";
import {
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from "class-validator";

export class QueryLuaModuleDto {
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
    @Transform(({ value }) => value === true || value === "true")
    @IsBoolean()
    isPublished?: boolean;
}

export class CreateLuaModuleDto {
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: "模块名称不能为空" })
    @MaxLength(100, { message: "模块名称不能超过100个字符" })
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsString()
    @IsNotEmpty({ message: "Lua 脚本不能为空" })
    @MaxLength(65536, { message: "Lua 脚本不能超过64KB" })
    draftCode: string;

    @IsObject()
    inputSchema: Record<string, unknown>;

    @IsObject()
    outputSchema: Record<string, unknown>;
}

export class UpdateLuaModuleDto {
    @IsOptional()
    @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @IsNotEmpty({ message: "模块名称不能为空" })
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: "Lua 脚本不能为空" })
    @MaxLength(65536)
    draftCode?: string;

    @IsOptional()
    @IsObject()
    inputSchema?: Record<string, unknown>;

    @IsOptional()
    @IsObject()
    outputSchema?: Record<string, unknown>;
}

export class TestLuaModuleDto {
    @IsOptional()
    @IsObject()
    params?: Record<string, unknown> = {};

    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: "Lua 脚本不能为空" })
    @MaxLength(65536)
    code?: string;
}
