import { OrganizationRole, type OrganizationRoleType } from "@buildingai/db/entities";
import {
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Length,
} from "class-validator";

const ORGANIZATION_ROLES = Object.values(OrganizationRole);

export class ConsoleCreateOrganizationDto {
    @IsString()
    @IsNotEmpty({ message: "组织名称不能为空" })
    @Length(2, 80, { message: "组织名称长度应为2-80个字符" })
    name: string;

    /** 不传则以当前管理员作为组织负责人。 */
    @IsOptional()
    @IsUUID(4, { message: "负责人ID格式不正确" })
    ownerId?: string;
}

export class ConsoleUpdateOrganizationDto {
    @IsOptional()
    @IsString()
    @Length(2, 80, { message: "组织名称长度应为2-80个字符" })
    name?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    appWhitelistEnabled?: boolean;
}

export class ConsoleUpdateMemberRolesDto {
    @IsArray()
    @ArrayMinSize(1, { message: "成员至少需要一个身份" })
    @ArrayUnique()
    @IsIn(ORGANIZATION_ROLES, { each: true })
    roles: OrganizationRoleType[];
}

export class ConsoleTeachingQueryDto {
    @IsOptional()
    @IsString()
    keyword?: string;

    @IsOptional()
    @IsUUID(4, { message: "组织ID格式不正确" })
    organizationId?: string;
}
