import { OrganizationAppType, type OrganizationAppTypeValue } from "@buildingai/db/entities";
import { Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    ValidateNested,
} from "class-validator";

const APP_TYPES = Object.values(OrganizationAppType);

export class AppGrantItemDto {
    @IsIn(APP_TYPES, { message: "应用类型不正确" })
    appType: OrganizationAppTypeValue;

    @IsString({ message: "应用标识格式不正确" })
    @MaxLength(120, { message: "应用标识不能超过120个字符" })
    appRefId: string;

    /** 空值表示整班授权。 */
    @IsOptional()
    @IsUUID(4, { message: "学生ID格式不正确" })
    userId?: string | null;

    @IsOptional()
    @IsBoolean({ message: "侧边栏设置必须是布尔值" })
    sidebarRequired?: boolean;
}

export class SaveAppGrantsDto {
    @IsArray()
    @ArrayMaxSize(2000, { message: "单次最多提交2000条授权" })
    @ValidateNested({ each: true })
    @Type(() => AppGrantItemDto)
    grants: AppGrantItemDto[];
}

export class UpdateAppWhitelistDto {
    @IsBoolean({ message: "白名单开关必须是布尔值" })
    enabled: boolean;
}
