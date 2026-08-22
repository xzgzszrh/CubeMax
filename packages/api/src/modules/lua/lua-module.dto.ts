import { Transform, Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
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
    ValidateNested,
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

    @IsOptional()
    @IsString()
    projectId?: string;

    @IsOptional()
    @Transform(({ value }) => value === true || value === "true")
    @IsBoolean()
    unassigned?: boolean;
}

export class LuaCodeDiffLineDto {
    @IsIn(["context", "addition", "deletion"])
    type: "context" | "addition" | "deletion";

    @IsString()
    @MaxLength(65536)
    content: string;

    @IsOptional()
    @IsInt()
    @Min(1)
    oldLineNumber?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    newLineNumber?: number;
}

export class LuaCodeDiffHunkDto {
    @IsString()
    @MaxLength(1000)
    header: string;

    @IsArray()
    @ArrayMaxSize(10000)
    @ValidateNested({ each: true })
    @Type(() => LuaCodeDiffLineDto)
    lines: LuaCodeDiffLineDto[];
}

export class LuaCodeDiffDto {
    @IsInt()
    @Min(0)
    additions: number;

    @IsInt()
    @Min(0)
    deletions: number;

    @IsArray()
    @ArrayMaxSize(1000)
    @ValidateNested({ each: true })
    @Type(() => LuaCodeDiffHunkDto)
    hunks: LuaCodeDiffHunkDto[];
}

export class LuaAssistantMessageDto {
    @IsIn(["user", "assistant"])
    role: "user" | "assistant";

    @IsString()
    @IsNotEmpty()
    @MaxLength(8000)
    content: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => LuaCodeDiffDto)
    codeDiff?: LuaCodeDiffDto;
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

    @IsOptional()
    @IsObject()
    testParams?: Record<string, unknown>;

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => LuaAssistantMessageDto)
    assistantMessages?: LuaAssistantMessageDto[];
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

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => LuaAssistantMessageDto)
    assistantMessages?: LuaAssistantMessageDto[];

    @IsOptional()
    @IsObject()
    testParams?: Record<string, unknown>;
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

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    simulatorSessionId?: string;
}

export class GenerateLuaModuleDto {
    @IsString()
    @IsNotEmpty({ message: "请选择生成代码所使用的模型" })
    modelId: string;

    @IsString()
    @IsNotEmpty({ message: "请输入对 Lua 模块的要求" })
    @MaxLength(4000)
    message: string;

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(12)
    @ValidateNested({ each: true })
    @Type(() => LuaAssistantMessageDto)
    messages?: LuaAssistantMessageDto[];

    @IsObject()
    current: {
        name?: unknown;
        description?: unknown;
        draftCode?: unknown;
        inputSchema?: unknown;
        outputSchema?: unknown;
        testParams?: unknown;
    };
}
