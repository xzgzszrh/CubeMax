import type { ClassroomDisplayLayout, ClassroomDisplaySortBy } from "@buildingai/db/entities";
import { Type } from "class-transformer";
import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator";

const DISPLAY_LAYOUTS: ClassroomDisplayLayout[] = ["grid", "leaderboard", "timeline"];
const DISPLAY_SORTS: ClassroomDisplaySortBy[] = ["completed_at", "score"];

export class ClassroomDisplayConfigDto {
    @IsString()
    @IsNotEmpty({ message: "大屏标题不能为空" })
    @MaxLength(60, { message: "大屏标题最长60个字符" })
    title: string;

    @IsOptional()
    @IsString()
    @MaxLength(120, { message: "大屏副标题最长120个字符" })
    subtitle?: string;

    @IsIn(DISPLAY_LAYOUTS, { message: "展示模式不正确" })
    layout: ClassroomDisplayLayout;

    @IsString()
    @Matches(/^#[0-9a-fA-F]{3,8}$/, { message: "强调色格式不正确" })
    accentColor: string;

    @Type(() => Number)
    @IsInt()
    @Min(2, { message: "网格列数最少2列" })
    @Max(6, { message: "网格列数最多6列" })
    columns: number;

    @IsBoolean()
    showTimer: boolean;

    @IsBoolean()
    showScore: boolean;

    @IsBoolean()
    showRecent: boolean;

    @IsString()
    @MaxLength(60, { message: "完成文案最长60个字符" })
    completionText: string;

    @IsIn(DISPLAY_SORTS, { message: "排行榜排序不正确" })
    sortBy: ClassroomDisplaySortBy;
}

export class SaveClassroomInteractionDto {
    @IsString()
    @IsNotEmpty({ message: "活动名称不能为空" })
    @Length(1, 60, { message: "活动名称长度应为1-60个字符" })
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(300, { message: "活动备注最长300个字符" })
    description?: string;

    @IsUUID(4, { message: "场景ID格式不正确" })
    sceneId: string;

    @IsArray()
    @ArrayMinSize(1, { message: "至少选择一个目标智能体" })
    @ArrayMaxSize(200, { message: "一个活动最多包含200个智能体" })
    @ArrayUnique({ message: "目标智能体不能重复" })
    @IsUUID(4, { each: true, message: "智能体ID格式不正确" })
    agentIds: string[];

    @IsObject({ message: "大屏配置格式不正确" })
    @ValidateNested()
    @Type(() => ClassroomDisplayConfigDto)
    displayConfig: ClassroomDisplayConfigDto;
}

export class ClassroomTestEventDto {
    @IsUUID(4, { message: "智能体ID格式不正确" })
    agentId: string;

    @IsOptional()
    @IsString()
    @MaxLength(120, { message: "任务标识最长120个字符" })
    taskKey?: string;

    @IsString()
    @IsNotEmpty({ message: "完成摘要不能为空" })
    @MaxLength(300, { message: "完成摘要最长300个字符" })
    summary: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: "得分格式不正确" })
    @Min(0)
    @Max(10000)
    score?: number;
}

export class ClassroomEventsQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(500)
    limit?: number;
}
