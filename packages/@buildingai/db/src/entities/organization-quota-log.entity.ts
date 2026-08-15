import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { BaseEntity } from "./base";

export const QuotaLogAction = {
    /** 管理员给班级额度池充值 */
    TOPUP: "topup",
    /** 老师把额度划拨给学生 */
    ALLOCATE: "allocate",
    /** 老师从学生处回收额度 */
    RECLAIM: "reclaim",
} as const;

export type QuotaLogActionType = (typeof QuotaLogAction)[keyof typeof QuotaLogAction];

@AppEntity({ name: "organization_quota_log", comment: "班级额度变动流水" })
export class OrganizationQuotaLog extends BaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "所属组织ID" })
    organizationId: string;

    @Index()
    @Column({ type: "uuid", nullable: true, comment: "涉及的学生ID，充值时为空" })
    targetUserId: string | null;

    @Column({ type: "varchar", length: 16, comment: "变动类型" })
    action: QuotaLogActionType;

    @Column({ type: "integer", comment: "变动数量" })
    amount: number;

    @Column({ type: "integer", comment: "变动后的额度池余额" })
    balanceAfter: number;

    @Column({ type: "uuid", comment: "操作人ID" })
    operatorUserId: string;

    @Column({ length: 200, default: "", comment: "备注" })
    remark: string;
}
