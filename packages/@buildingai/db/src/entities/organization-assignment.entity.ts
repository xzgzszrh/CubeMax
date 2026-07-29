import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";

export const AssignmentStatus = {
    DRAFT: "draft",
    PUBLISHED: "published",
    CLOSED: "closed",
} as const;

export type AssignmentStatusType = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const AssignmentTargetType = {
    WORKFLOW: "workflow",
    AGENT: "agent",
} as const;

export type AssignmentTargetTypeValue =
    (typeof AssignmentTargetType)[keyof typeof AssignmentTargetType];

@AppEntity({
    name: "organization_assignment",
    comment: "班级作业（老师布置，学生提交工作流或智能体）",
})
export class OrganizationAssignment extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "所属组织ID" })
    organizationId: string;

    @Index()
    @Column({ type: "uuid", comment: "布置作业的老师ID" })
    ownerUserId: string;

    @Column({ length: 100, comment: "作业标题" })
    title: string;

    @Column({ type: "text", default: "", comment: "作业说明" })
    description: string;

    @Column({ type: "timestamptz", nullable: true, comment: "截止时间" })
    dueAt: Date | null;

    @Column({
        type: "jsonb",
        default: () => `'["workflow","agent"]'`,
        comment: "允许提交的成果类型",
    })
    allowedTypes: AssignmentTargetTypeValue[];

    @Column({ type: "varchar", length: 16, default: AssignmentStatus.DRAFT, comment: "作业状态" })
    status: AssignmentStatusType;

    @Column({
        type: "jsonb",
        default: () => "'[]'",
        comment: "生效的学生ID列表，空数组表示全班",
    })
    targetUserIds: string[];
}
