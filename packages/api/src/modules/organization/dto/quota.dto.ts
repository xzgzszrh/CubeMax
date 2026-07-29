import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class AllocateQuotaDto {
    @IsUUID(4, { message: "学生ID格式不正确" })
    userId: string;

    @IsInt({ message: "额度必须是整数" })
    @Min(1, { message: "额度必须大于0" })
    amount: number;

    @IsOptional()
    @IsString()
    @MaxLength(200, { message: "备注最多200个字符" })
    remark?: string;
}

export class TopupQuotaDto {
    @IsInt({ message: "额度必须是整数" })
    @Min(1, { message: "额度必须大于0" })
    amount: number;

    @IsOptional()
    @IsString()
    @MaxLength(200, { message: "备注最多200个字符" })
    remark?: string;
}
