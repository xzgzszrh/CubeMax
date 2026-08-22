import { Type } from "class-transformer";
import {
    IsIn,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from "class-validator";

import { YEELIGHT_PRO_REGIONS } from "./yeelight-pro.constants";

export class StartYeelightProQrDto {
    @IsOptional()
    @IsIn(Object.keys(YEELIGHT_PRO_REGIONS))
    region?: string;
}

export class SelectYeelightProHouseDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    houseId: string;
}

export class QueryYeelightProDevicesDto {
    @IsOptional()
    @IsString()
    @MaxLength(80)
    houseId?: string;

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

export class YeelightProPropertyCommandDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(40)
    name: string;

    @IsNotEmpty({ message: "属性值不能为空" })
    value: unknown;
}

export class YeelightProLightCommandDto {
    @IsOptional()
    @IsObject()
    properties?: Record<string, unknown>;

    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(0)
    duration?: number;
}

export class UpdateYeelightProAccountDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    label: string;
}
