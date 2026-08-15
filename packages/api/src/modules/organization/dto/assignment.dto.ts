import { AssignmentTargetType, type AssignmentTargetTypeValue } from "@buildingai/db/entities";
import {
    ArrayMaxSize,
    ArrayMinSize,
    ArrayUnique,
    IsArray,
    IsIn,
    IsInt,
    IsISO8601,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Max,
    MaxLength,
    Min,
} from "class-validator";

const TARGET_TYPES = Object.values(AssignmentTargetType);

export class SaveAssignmentDto {
    @IsString()
    @IsNotEmpty({ message: "作业标题不能为空" })
    @Length(2, 100, { message: "作业标题长度应为2-100个字符" })
    title: string;

    @IsOptional()
    @IsString()
    @MaxLength(2000, { message: "作业说明最多2000个字符" })
    description?: string;

    @IsOptional()
    @IsISO8601({}, { message: "截止时间格式不正确" })
    dueAt?: string | null;

    @IsOptional()
    @IsArray()
    @ArrayMinSize(1, { message: "至少允许一种提交类型" })
    @ArrayUnique()
    @IsIn(TARGET_TYPES, { each: true })
    allowedTypes?: AssignmentTargetTypeValue[];

    /** 空数组或不传表示全班生效。 */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500, { message: "单次最多指派500个学生" })
    @ArrayUnique()
    @IsUUID(4, { each: true, message: "学生ID格式不正确" })
    targetUserIds?: string[];
}

export class SubmitAssignmentDto {
    @IsIn(TARGET_TYPES, { message: "提交类型不正确" })
    targetType: AssignmentTargetTypeValue;

    @IsUUID(4, { message: "成果ID格式不正确" })
    targetId: string;

    @IsOptional()
    @IsString()
    @MaxLength(500, { message: "提交备注最多500个字符" })
    remark?: string;
}

export class ReviewSubmissionDto {
    @IsOptional()
    @IsInt({ message: "评分必须是整数" })
    @Min(0, { message: "评分不能小于0" })
    @Max(100, { message: "评分不能大于100" })
    score?: number | null;

    @IsOptional()
    @IsString()
    @MaxLength(1000, { message: "评语最多1000个字符" })
    feedback?: string;
}
