import {
    ArrayMaxSize,
    ArrayNotEmpty,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Max,
    Min,
} from "class-validator";

import {
    DURATION_MINUTES_RANGE,
    PASSWORD_LENGTH_RANGE,
    PasswordMode,
    type PasswordModeType,
    type StartGamePayload,
} from "../../../shared/contract";

/** 一个班一次最多同时接管多少台方糖猫，纯粹是给批量下发兜个上限。 */
const MAX_DEVICES = 200;

export class StartGameDto implements StartGamePayload {
    @IsString({ message: "游戏标题必须是文本" })
    @Length(1, 120, { message: "游戏标题长度需在 1 到 120 之间" })
    @IsOptional()
    title?: string;

    @IsArray({ message: "请选择参与游戏的方糖猫" })
    @ArrayNotEmpty({ message: "至少要选一台方糖猫" })
    @ArrayMaxSize(MAX_DEVICES, { message: `一局最多 ${MAX_DEVICES} 台方糖猫` })
    @IsUUID("4", { each: true, message: "方糖猫标识不合法" })
    agentBindingIds: string[];

    @IsString({ message: "提示词模板必须是文本" })
    @Length(1, 4000, { message: "提示词模板长度需在 1 到 4000 之间" })
    @IsOptional()
    promptTemplate?: string;

    @IsIn(Object.values(PasswordMode), { message: "密码分配方式不合法" })
    @IsOptional()
    passwordMode?: PasswordModeType;

    @IsInt({ message: "密码位数必须是整数" })
    @Min(PASSWORD_LENGTH_RANGE.min, { message: `密码至少 ${PASSWORD_LENGTH_RANGE.min} 位` })
    @Max(PASSWORD_LENGTH_RANGE.max, { message: `密码最多 ${PASSWORD_LENGTH_RANGE.max} 位` })
    @IsOptional()
    passwordLength?: number;

    @IsInt({ message: "游戏时长必须是整数" })
    @Min(DURATION_MINUTES_RANGE.min, { message: `游戏时长至少 ${DURATION_MINUTES_RANGE.min} 分钟` })
    @Max(DURATION_MINUTES_RANGE.max, { message: `游戏时长最多 ${DURATION_MINUTES_RANGE.max} 分钟` })
    @IsOptional()
    durationMinutes?: number;

    @IsBoolean({ message: "「允许方糖猫上报」必须是布尔值" })
    @IsOptional()
    allowDeviceReport?: boolean;

    @IsBoolean({ message: "「允许学生页面提交」必须是布尔值" })
    @IsOptional()
    allowStudentInput?: boolean;

    @IsBoolean({ message: "「启用学生端」必须是布尔值" })
    @IsOptional()
    enableStudentView?: boolean;

    @IsBoolean({ message: "「锁定学生设置」必须是布尔值" })
    @IsOptional()
    lockStudentEdits?: boolean;
}
