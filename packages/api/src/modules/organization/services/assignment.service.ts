import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    Agent,
    AiWorkflow,
    AssignmentStatus,
    AssignmentTargetType,
    OrganizationAssignment,
    OrganizationAssignmentSubmission,
    OrganizationMember,
    SubmissionStatus,
    User,
} from "@buildingai/db/entities";
import { In, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { OrganizationPermission } from "../constants/organization-permissions";
import type {
    ReviewSubmissionDto,
    SaveAssignmentDto,
    SubmitAssignmentDto,
} from "../dto/assignment.dto";
import { OrganizationService } from "./organization.service";

/** 提交列表里带上的学生资料，避免前端再查一次成员表。 */
type SubmissionAuthor = {
    userId: string;
    username: string;
    nickname: string;
    realName?: string;
    avatar?: string;
};

@Injectable()
export class AssignmentService {
    constructor(
        @InjectRepository(OrganizationAssignment)
        private readonly assignmentRepository: Repository<OrganizationAssignment>,
        @InjectRepository(OrganizationAssignmentSubmission)
        private readonly submissionRepository: Repository<OrganizationAssignmentSubmission>,
        @InjectRepository(OrganizationMember)
        private readonly memberRepository: Repository<OrganizationMember>,
        @InjectRepository(AiWorkflow)
        private readonly workflowRepository: Repository<AiWorkflow>,
        @InjectRepository(Agent)
        private readonly agentRepository: Repository<Agent>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly organizationService: OrganizationService,
    ) {}

    private async requirePublisher(userId: string, organizationId: string) {
        return this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.ASSIGNMENT_PUBLISH,
        );
    }

    private async resolveAssignment(organizationId: string, assignmentId: string) {
        const assignment = await this.assignmentRepository.findOne({
            where: { id: assignmentId, organizationId },
        });
        if (!assignment) throw HttpErrorFactory.notFound("作业不存在");
        return assignment;
    }

    /** 一次性把作业的提交数量补上，列表页直接可用。 */
    private async withSubmissionCounts(assignments: OrganizationAssignment[]) {
        if (!assignments.length) return [];
        const rows = await this.submissionRepository
            .createQueryBuilder("submission")
            .select("submission.assignment_id", "assignmentId")
            .addSelect("COUNT(*)", "count")
            .where("submission.assignment_id IN (:...ids)", {
                ids: assignments.map((item) => item.id),
            })
            .andWhere("submission.deleted_at IS NULL")
            .groupBy("submission.assignment_id")
            .getRawMany<{ assignmentId: string; count: string }>();
        const counts = new Map(rows.map((row) => [row.assignmentId, Number(row.count)]));
        return assignments.map((assignment) => ({
            ...assignment,
            submissionCount: counts.get(assignment.id) ?? 0,
        }));
    }

    async list(userId: string, organizationId: string) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.ASSIGNMENT_PUBLISH,
        );
        const assignments = await this.assignmentRepository.find({
            where: { organizationId },
            order: { createdAt: "DESC" },
        });
        return this.withSubmissionCounts(assignments);
    }

    /** 指派名单必须都是本组织成员；空名单表示全班。 */
    private async resolveTargetUserIds(organizationId: string, targetUserIds?: string[]) {
        if (!targetUserIds?.length) return [];
        const memberIds = new Set(await this.organizationService.listMemberUserIds(organizationId));
        const outsider = targetUserIds.find((id) => !memberIds.has(id));
        if (outsider) throw HttpErrorFactory.badRequest("指派名单里有不属于本组织的成员");
        return [...new Set(targetUserIds)];
    }

    async save(
        userId: string,
        organizationId: string,
        dto: SaveAssignmentDto,
        assignmentId?: string,
    ) {
        await this.requirePublisher(userId, organizationId);

        const payload = {
            title: dto.title.trim(),
            description: dto.description?.trim() ?? "",
            dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
            allowedTypes: dto.allowedTypes ?? [
                AssignmentTargetType.WORKFLOW,
                AssignmentTargetType.AGENT,
            ],
            targetUserIds: await this.resolveTargetUserIds(organizationId, dto.targetUserIds),
        };

        if (assignmentId) {
            const assignment = await this.resolveAssignment(organizationId, assignmentId);
            Object.assign(assignment, payload);
            return this.assignmentRepository.save(assignment);
        }

        return this.assignmentRepository.save(
            this.assignmentRepository.create({
                ...payload,
                organizationId,
                ownerUserId: userId,
                status: AssignmentStatus.DRAFT,
            }),
        );
    }

    async remove(userId: string, organizationId: string, assignmentId: string) {
        await this.requirePublisher(userId, organizationId);
        const assignment = await this.resolveAssignment(organizationId, assignmentId);
        await this.assignmentRepository.softRemove(assignment);
        return { success: true };
    }

    async updateStatus(
        userId: string,
        organizationId: string,
        assignmentId: string,
        status: typeof AssignmentStatus.PUBLISHED | typeof AssignmentStatus.CLOSED,
    ) {
        await this.requirePublisher(userId, organizationId);
        const assignment = await this.resolveAssignment(organizationId, assignmentId);
        assignment.status = status;
        return this.assignmentRepository.save(assignment);
    }

    private async loadAuthors(userIds: string[]): Promise<Map<string, SubmissionAuthor>> {
        if (!userIds.length) return new Map();
        const users = await this.userRepository.find({
            where: { id: In(userIds) },
            select: ["id", "username", "nickname", "realName", "avatar"],
        });
        return new Map(
            users.map((user) => [
                user.id,
                {
                    userId: user.id,
                    username: user.username,
                    nickname: user.nickname,
                    realName: user.realName,
                    avatar: user.avatar,
                },
            ]),
        );
    }

    async listSubmissions(userId: string, organizationId: string, assignmentId: string) {
        await this.requirePublisher(userId, organizationId);
        await this.resolveAssignment(organizationId, assignmentId);

        const submissions = await this.submissionRepository.find({
            where: { assignmentId, organizationId },
            order: { submittedAt: "DESC" },
        });
        const authors = await this.loadAuthors(submissions.map((item) => item.studentUserId));
        return submissions.map((submission) => ({
            ...submission,
            author: authors.get(submission.studentUserId) ?? null,
        }));
    }

    async review(
        userId: string,
        organizationId: string,
        submissionId: string,
        dto: ReviewSubmissionDto,
    ) {
        await this.requirePublisher(userId, organizationId);
        const submission = await this.submissionRepository.findOne({
            where: { id: submissionId, organizationId },
        });
        if (!submission) throw HttpErrorFactory.notFound("提交记录不存在");

        submission.score = dto.score ?? null;
        submission.feedback = dto.feedback?.trim() ?? "";
        submission.status = SubmissionStatus.REVIEWED;
        submission.reviewedByUserId = userId;
        return this.submissionRepository.save(submission);
    }

    /** 作业是否对某个学生生效：空名单表示全班。 */
    private isAssignedTo(assignment: OrganizationAssignment, userId: string) {
        return !assignment.targetUserIds?.length || assignment.targetUserIds.includes(userId);
    }

    /** 学生视角：列出自己所在组织已发布、且指派给自己的作业以及提交状态。 */
    async listMine(userId: string, organizationId: string) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.ASSIGNMENT_SUBMIT,
        );

        const published = await this.assignmentRepository.find({
            where: {
                organizationId,
                status: In([AssignmentStatus.PUBLISHED, AssignmentStatus.CLOSED]),
            },
            order: { createdAt: "DESC" },
        });
        // 单个班级的作业量很小，直接在内存里按指派名单过滤，比 jsonb 查询更好读。
        const assignments = published.filter((item) => this.isAssignedTo(item, userId));
        if (!assignments.length) return [];

        const submissions = await this.submissionRepository.find({
            where: {
                assignmentId: In(assignments.map((item) => item.id)),
                studentUserId: userId,
            },
        });
        const byAssignment = new Map(submissions.map((item) => [item.assignmentId, item]));
        return assignments.map((assignment) => ({
            ...assignment,
            mySubmission: byAssignment.get(assignment.id) ?? null,
        }));
    }

    /**
     * 提交成果。提交时把工作流 schema / 智能体配置整体快照下来，
     * 老师预览的是提交那一刻的内容，后续学生再改也不影响已交作业。
     */
    private async buildSnapshot(userId: string, dto: SubmitAssignmentDto) {
        if (dto.targetType === AssignmentTargetType.WORKFLOW) {
            const workflow = await this.workflowRepository.findOne({
                where: { id: dto.targetId, createBy: userId },
            });
            if (!workflow) throw HttpErrorFactory.notFound("工作流不存在或不属于你");
            return {
                targetName: workflow.name,
                snapshot: {
                    kind: "workflow" as const,
                    name: workflow.name,
                    description: workflow.description ?? "",
                    isPublished: workflow.isPublished,
                    schema: workflow.schema ?? null,
                },
            };
        }

        const agent = await this.agentRepository.findOne({
            where: { id: dto.targetId, createBy: userId },
        });
        if (!agent) throw HttpErrorFactory.notFound("智能体不存在或不属于你");
        return {
            targetName: agent.name,
            snapshot: {
                kind: "agent" as const,
                name: agent.name,
                description: agent.description ?? "",
                rolePrompt: agent.rolePrompt ?? "",
                modelConfig: agent.modelConfig ?? null,
                openingStatement: agent.openingStatement ?? "",
            },
        };
    }

    async submit(
        userId: string,
        organizationId: string,
        assignmentId: string,
        dto: SubmitAssignmentDto,
    ) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.ASSIGNMENT_SUBMIT,
        );

        const assignment = await this.resolveAssignment(organizationId, assignmentId);
        if (assignment.status !== AssignmentStatus.PUBLISHED) {
            throw HttpErrorFactory.badRequest("作业未发布或已关闭，无法提交");
        }
        if (!this.isAssignedTo(assignment, userId)) {
            throw HttpErrorFactory.forbidden("这份作业没有指派给你");
        }
        if (!assignment.allowedTypes.includes(dto.targetType)) {
            throw HttpErrorFactory.badRequest("该作业不接受这种类型的成果");
        }
        if (assignment.dueAt && assignment.dueAt.getTime() < Date.now()) {
            throw HttpErrorFactory.badRequest("作业已过截止时间");
        }

        const member = await this.memberRepository.findOne({
            where: { organizationId, userId },
        });
        if (!member) throw HttpErrorFactory.forbidden("你不是该组织的成员");

        const { targetName, snapshot } = await this.buildSnapshot(userId, dto);

        const existing = await this.submissionRepository.findOne({
            where: { assignmentId, studentUserId: userId },
        });

        // 重复提交覆盖上一次，保持「一人一份」并刷新快照与批阅状态。
        const record =
            existing ??
            this.submissionRepository.create({
                assignmentId,
                organizationId,
                studentUserId: userId,
            });
        record.targetType = dto.targetType;
        record.targetId = dto.targetId;
        record.targetName = targetName;
        record.snapshot = snapshot;
        record.remark = dto.remark?.trim() ?? "";
        record.status = SubmissionStatus.SUBMITTED;
        record.score = null;
        record.feedback = "";
        record.reviewedByUserId = null;
        record.submittedAt = new Date();

        return this.submissionRepository.save(record);
    }
}
