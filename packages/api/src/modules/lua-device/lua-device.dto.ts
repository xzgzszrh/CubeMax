import { Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    Max,
    MaxLength,
    Min,
} from "class-validator";

export class CreateLuaDeviceRunDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsUUID()
    moduleId?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(65536)
    source: string;

    @IsObject()
    params: Record<string, unknown>;

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(16)
    @Matches(/^[a-z][a-z0-9_.-]{0,31}$/, { each: true })
    requiredCapabilities?: string[];

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1000)
    @Max(60000)
    timeoutMs?: number;
}

export class QueryLuaRunLogsDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    after?: number = 0;
}
