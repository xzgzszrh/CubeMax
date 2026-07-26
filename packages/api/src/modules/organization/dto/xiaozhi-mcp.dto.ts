import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Matches,
    Max,
    MaxLength,
    Min,
} from "class-validator";

export class UpdateXiaozhiMcpSettingsDto {
    @IsString()
    @Length(1, 64, { message: "工具名称长度应为1-64个字符" })
    @Matches(/^[A-Za-z][A-Za-z0-9_-]*$/, {
        message: "工具名称只能包含字母、数字、下划线和连字符，且以字母开头",
    })
    toolName: string;

    @IsString()
    @Length(1, 80, { message: "显示名称长度应为1-80个字符" })
    toolTitle: string;

    @IsString()
    @Length(1, 600, { message: "工具说明长度应为1-600个字符" })
    toolDescription: string;

    @IsString()
    @Length(1, 300, { message: "task_key 参数说明长度应为1-300个字符" })
    taskKeyDescription: string;

    @IsString()
    @Length(1, 300, { message: "summary 参数说明长度应为1-300个字符" })
    summaryDescription: string;

    @IsString()
    @Length(1, 300, { message: "score 参数说明长度应为1-300个字符" })
    scoreDescription: string;

    @IsString()
    @Length(1, 2000, { message: "提示词模板长度应为1-2000个字符" })
    promptTemplate: string;
}

export class BatchConfigureXiaozhiMcpDto {
    /** 省略时表示为当前工作空间下的全部智能体自动配置接入点 */
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1, { message: "至少需要选择一个智能体" })
    @ArrayMaxSize(200, { message: "单次最多配置200个智能体" })
    @ArrayUnique()
    @IsUUID(4, { each: true, message: "智能体ID格式不正确" })
    agentIds?: string[];
}

export class UpdateXiaozhiMcpConnectionDto {
    @IsBoolean({ message: "enabled 必须是布尔值" })
    enabled: boolean;
}

export class ReportXiaozhiMcpCompletionDto {
    @IsOptional()
    @IsString()
    @MaxLength(100, { message: "任务标识最长100个字符" })
    taskKey?: string;

    @IsString()
    @Length(1, 300, { message: "完成摘要长度应为1-300个字符" })
    summary: string;

    @IsOptional()
    @IsNumber({}, { message: "得分必须是数字" })
    @Min(0, { message: "得分不能小于0" })
    @Max(100, { message: "得分不能大于100" })
    score?: number | null;
}
