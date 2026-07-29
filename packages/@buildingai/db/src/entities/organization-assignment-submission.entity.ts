import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, Unique } from "../typeorm";
import { SoftDeleteBaseEntity } from "./base";
import type { AssignmentTargetTypeValue } from "./organization-assignment.entity";

export const SubmissionStatus = {
    SUBMITTED: "submitted",
    REVIEWED: "reviewed",
} as const;

export type SubmissionStatusType = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

@AppEntity({
    name: "organization_assignment_submission",
    comment: "班级作业提交（含提交时的成果快照）",
})
@Unique("UQ_assignment_submission_student", ["assignmentId", "studentUserId"])
export class OrganizationAssignmentSubmission extends SoftDeleteBaseEntity {
    @Index()
    @Column({ type: "uuid", comment: "作业ID" })
    assignmentId: string;

    @Index()
    @Column({ type: "uuid", comment: "所属组织ID" })
    organizationId: string;

    @Index()
    @Column({ type: "uuid", comment: "提交的学生ID" })
    studentUserId: string;

    @Column({ type: "varchar", length: 16, comment: "成果类型：workflow / agent" })
    targetType: AssignmentTargetTypeValue;

    @Column({ type: "uuid", comment: "成果ID" })
    targetId: string;

    @Column({ length: 255, default: "", comment: "成果名称快照" })
    targetName: string;

    @Column({ type: "jsonb", default: () => "'{}'", comment: "提交时的成果内容快照，供老师预览" })
    snapshot: Record<string, unknown>;

    @Column({ type: "text", default: "", comment: "学生提交备注" })
    remark: string;

    @Column({
        type: "varchar",
        length: 16,
        default: SubmissionStatus.SUBMITTED,
        comment: "提交状态",
    })
    status: SubmissionStatusType;

    @Column({ type: "int", nullable: true, comment: "老师评分" })
    score: number | null;

    @Column({ type: "text", default: "", comment: "老师评语" })
    feedback: string;

    @Column({ type: "uuid", nullable: true, comment: "批阅老师ID" })
    reviewedByUserId: string | null;

    @Column({ type: "timestamptz", comment: "提交时间" })
    submittedAt: Date;
}
