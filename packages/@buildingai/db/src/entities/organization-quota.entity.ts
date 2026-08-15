import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

@AppEntity({ name: "organization_quota", comment: "班级 AI 额度池" })
export class OrganizationQuota extends SoftDeleteBaseEntity {
    @Index({ unique: true })
    @Column({ type: "uuid", comment: "所属组织ID" })
    organizationId: string;

    @Column({ type: "integer", default: 0, comment: "额度池当前余额" })
    balance: number;

    @Column({ type: "integer", default: 0, comment: "累计充值额度" })
    totalGranted: number;

    @Column({ type: "integer", default: 0, comment: "累计划拨给学生的额度" })
    totalAllocated: number;
}
