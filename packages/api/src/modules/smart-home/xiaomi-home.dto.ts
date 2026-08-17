import { Type } from "class-transformer";
import {
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from "class-validator";

import { XIAOMI_HOME_SERVERS } from "./xiaomi-home.constants";

export class StartXiaomiHomeOAuthDto {
    @IsOptional()
    @IsIn(Object.keys(XIAOMI_HOME_SERVERS))
    cloudServer?: string;

    @IsOptional()
    @IsIn(["direct", "local_token"])
    mode?: "direct" | "local_token";
}

export class ImportXiaomiHomeCredentialsDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(32_000)
    credentials: string;
}

export class QueryXiaomiHomeDevicesDto {
    @IsOptional()
    @IsString()
    @MaxLength(80)
    homeId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    roomId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(32)
    category?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    keyword?: string;
}

export class XiaomiHomePropertyCommandDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    siid: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    piid: number;

    @IsNotEmpty({ message: "属性值不能为空" })
    value: unknown;
}

export class XiaomiHomeActionCommandDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    siid: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    aiid: number;

    @IsOptional()
    @IsArray()
    in?: unknown[];
}

export class UpdateXiaomiHomeAccountDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    label: string;
}
