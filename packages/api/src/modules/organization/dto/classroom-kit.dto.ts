import { Type } from "class-transformer";
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator";

/** 单台设备的一份配置下发。 */
export class ClassroomConfigTargetDto {
    @IsUUID(4, { message: "方糖猫ID格式不正确" })
    agentBindingId: string;

    @IsObject({ message: "配置必须是对象" })
    config: Record<string, unknown>;
}

export class ApplyClassroomConfigDto {
    @IsArray()
    @ArrayMaxSize(500, { message: "单次最多下发500台设备" })
    @ValidateNested({ each: true })
    @Type(() => ClassroomConfigTargetDto)
    targets: ClassroomConfigTargetDto[];
}

export class ApplyClassroomPromptDto {
    /** key 是方糖猫ID，value 是完整的新人设。 */
    @IsObject({ message: "提示词必须以 { 设备ID: 提示词 } 的形式提交" })
    prompts: Record<string, string>;
}

export class AppendClassroomPromptDto {
    @IsArray()
    @ArrayMaxSize(500, { message: "单次最多下发500台设备" })
    @IsUUID(4, { each: true, message: "方糖猫ID格式不正确" })
    agentBindingIds: string[];

    @IsString()
    @IsNotEmpty({ message: "追加内容不能为空" })
    @MaxLength(4000, { message: "追加内容过长" })
    snippet: string;

    @IsOptional()
    @IsString()
    @MaxLength(16)
    separator?: string;
}

export class StartClassroomSessionDto {
    @IsString()
    @IsNotEmpty({ message: "sessionKey 不能为空" })
    @MaxLength(120)
    sessionKey: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    title?: string;

    @IsArray()
    @ArrayMaxSize(500, { message: "单次最多接管500台设备" })
    @IsUUID(4, { each: true, message: "方糖猫ID格式不正确" })
    agentBindingIds: string[];

    @IsOptional()
    @IsBoolean()
    suppressClassroomTool?: boolean;

    @IsOptional()
    @IsBoolean()
    lockStudentEdits?: boolean;

    @IsOptional()
    @IsObject()
    prompts?: Record<string, string>;

    @IsOptional()
    @IsString()
    @MaxLength(4000)
    appendPrompt?: string;

    @IsOptional()
    @IsObject()
    config?: Record<string, unknown>;

    @IsOptional()
    @IsInt()
    @Min(0, { message: "时长不能为负" })
    @Max(1440, { message: "单次接管最长24小时" })
    durationMinutes?: number;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
