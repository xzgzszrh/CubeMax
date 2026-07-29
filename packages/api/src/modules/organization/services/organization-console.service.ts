import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    ClassroomInteraction,
    Organization,
    OrganizationMember,
    OrganizationQuota,
    OrganizationRole,
    type OrganizationRoleType,
    User,
    XiaozhiAccount,
    XiaozhiAgentBinding,
    XiaozhiQuickCommand,
    XiaozhiScene,
} from "@buildingai/db/entities";
import { In, Like, type ObjectLiteral, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";
import { randomInt } from "crypto";

import type {
    ConsoleCreateOrganizationDto,
    ConsoleUpdateOrganizationDto,
} from "../dto/organization-console.dto";
import type { TopupQuotaDto } from "../dto/quota.dto";
import { OrganizationQuotaService } from "./organization-quota.service";

/**
 * 管理员工作台的教学管理服务。
 *
 * 与 `OrganizationService` 的区别：这里的调用方已经通过后台 RBAC 鉴权，
 * 不再受组织成员身份限制，可以跨组织读写。
 */
@Injectable()
export class OrganizationConsoleService {
    constructor(
        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,
        @InjectRepository(OrganizationMember)
        private readonly memberRepository: Repository<OrganizationMember>,
        @InjectRepository(OrganizationQuota)
        private readonly quotaRepository: Repository<OrganizationQuota>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(XiaozhiAccount)
        private readonly accountRepository: Repository<XiaozhiAccount>,
        @InjectRepository(XiaozhiAgentBinding)
        private readonly agentRepository: Repository<XiaozhiAgentBinding>,
        @InjectRepository(XiaozhiScene)
        private readonly sceneRepository: Repository<XiaozhiScene>,
        @InjectRepository(XiaozhiQuickCommand)
        private readonly commandRepository: Repository<XiaozhiQuickCommand>,
        @InjectRepository(ClassroomInteraction)
        private readonly interactionRepository: Repository<ClassroomInteraction>,
        private readonly quotaService: OrganizationQuotaService,
    ) {}

    /** 按 organization_id 分组统计任意带该列的表。 */
    private async countByOrganization(
        repository: Repository<ObjectLiteral>,
        organizationIds: string[],
    ) {
        if (!organizationIds.length) return new Map<string, number>();
        const rows = await repository
            .createQueryBuilder("item")
            .select("item.organization_id", "organizationId")
            .addSelect("COUNT(*)", "count")
            .where("item.organization_id IN (:...ids)", { ids: organizationIds })
            .andWhere("item.deleted_at IS NULL")
            .groupBy("item.organization_id")
            .getRawMany<{ organizationId: string; count: string }>();
        return new Map(rows.map((row) => [row.organizationId, Number(row.count)]));
    }

    async listOrganizations(keyword?: string) {
        const query = this.organizationRepository
            .createQueryBuilder("organization")
            .orderBy("organization.created_at", "DESC");
        if (keyword?.trim()) {
            query.where("(organization.name ILIKE :keyword OR organization.code ILIKE :keyword)", {
                keyword: `%${keyword.trim()}%`,
            });
        }
        const organizations = await query.getMany();
        const ids = organizations.map((item) => item.id);

        const [memberCounts, agentCounts, quotas, owners] = await Promise.all([
            this.countByOrganization(this.memberRepository, ids),
            this.countByOrganization(this.agentRepository, ids),
            ids.length
                ? this.quotaRepository.find({ where: { organizationId: In(ids) } })
                : Promise.resolve([]),
            organizations.length
                ? this.userRepository.find({
                      where: { id: In(organizations.map((item) => item.ownerId)) },
                      select: ["id", "username", "nickname", "realName"],
                  })
                : Promise.resolve([]),
        ]);

        const quotaByOrganization = new Map(quotas.map((quota) => [quota.organizationId, quota]));
        const ownerById = new Map(
            owners.map((owner) => [owner.id, owner.realName || owner.nickname || owner.username]),
        );

        return organizations.map((organization) => ({
            id: organization.id,
            name: organization.name,
            code: organization.code,
            isActive: organization.isActive,
            appWhitelistEnabled: organization.appWhitelistEnabled,
            ownerId: organization.ownerId,
            ownerName: ownerById.get(organization.ownerId) ?? "未知",
            createdAt: organization.createdAt,
            memberCount: memberCounts.get(organization.id) ?? 0,
            agentCount: agentCounts.get(organization.id) ?? 0,
            quotaBalance: quotaByOrganization.get(organization.id)?.balance ?? 0,
            quotaTotalGranted: quotaByOrganization.get(organization.id)?.totalGranted ?? 0,
            quotaTotalAllocated: quotaByOrganization.get(organization.id)?.totalAllocated ?? 0,
        }));
    }

    /** 组织编号在整个系统里唯一，重试若干次避开碰撞。 */
    private async generateCode() {
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const code = String(randomInt(100000, 999999));
            const existing = await this.organizationRepository.findOne({
                where: { code },
                withDeleted: true,
            });
            if (!existing) return code;
        }
        throw HttpErrorFactory.badRequest("生成组织编号失败，请重试");
    }

    async createOrganization(operatorUserId: string, dto: ConsoleCreateOrganizationDto) {
        const ownerId = dto.ownerId ?? operatorUserId;
        const owner = await this.userRepository.findOne({ where: { id: ownerId } });
        if (!owner) throw HttpErrorFactory.badRequest("指定的负责人不存在");

        return this.organizationRepository.manager.transaction(async (manager) => {
            const organization = await manager.getRepository(Organization).save(
                manager.getRepository(Organization).create({
                    name: dto.name.trim(),
                    code: await this.generateCode(),
                    ownerId,
                    isActive: true,
                }),
            );

            await manager.getRepository(OrganizationMember).save(
                manager.getRepository(OrganizationMember).create({
                    organizationId: organization.id,
                    userId: ownerId,
                    roles: [OrganizationRole.ADMIN],
                    memberType: "owner",
                    canLeave: false,
                }),
            );

            return organization;
        });
    }

    async updateOrganization(organizationId: string, dto: ConsoleUpdateOrganizationDto) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) throw HttpErrorFactory.notFound("组织不存在");

        if (dto.name !== undefined) organization.name = dto.name.trim();
        if (dto.isActive !== undefined) organization.isActive = dto.isActive;
        if (dto.appWhitelistEnabled !== undefined) {
            organization.appWhitelistEnabled = dto.appWhitelistEnabled;
        }
        return this.organizationRepository.save(organization);
    }

    async listMembers(organizationId: string) {
        const members = await this.memberRepository.find({
            where: { organizationId },
            order: { createdAt: "ASC" },
        });
        if (!members.length) return [];

        const users = await this.userRepository.find({
            where: { id: In(members.map((member) => member.userId)) },
            select: ["id", "username", "nickname", "realName", "avatar", "power"],
        });
        const userById = new Map(users.map((user) => [user.id, user]));

        return members.map((member) => {
            const user = userById.get(member.userId);
            return {
                id: member.id,
                userId: member.userId,
                roles: member.roles,
                memberType: member.memberType,
                canLeave: member.canLeave,
                createdAt: member.createdAt,
                username: user?.username ?? "",
                nickname: user?.nickname ?? "",
                realName: user?.realName,
                avatar: user?.avatar,
                power: user?.power ?? 0,
            };
        });
    }

    async updateMemberRoles(
        organizationId: string,
        memberId: string,
        roles: OrganizationRoleType[],
    ) {
        const member = await this.memberRepository.findOne({
            where: { id: memberId, organizationId },
        });
        if (!member) throw HttpErrorFactory.notFound("成员不存在");
        if (member.memberType === "owner") {
            throw HttpErrorFactory.badRequest("组织创建人的身份不可修改");
        }
        member.roles = roles;
        return this.memberRepository.save(member);
    }

    async removeMember(organizationId: string, memberId: string) {
        const member = await this.memberRepository.findOne({
            where: { id: memberId, organizationId },
        });
        if (!member) throw HttpErrorFactory.notFound("成员不存在");
        if (member.memberType === "owner") {
            throw HttpErrorFactory.badRequest("组织创建人不能被移出组织");
        }
        await this.memberRepository.softRemove(member);
        return { success: true };
    }

    /** 全站方糖猫资产总览：账号 → 智能体 → 分发对象。 */
    async listDevices(organizationId?: string) {
        const where = organizationId ? { organizationId } : {};
        const [accounts, agents] = await Promise.all([
            this.accountRepository.find({ where, order: { createdAt: "DESC" } }),
            this.agentRepository.find({ where, order: { createdAt: "DESC" } }),
        ]);

        const organizationIds = [
            ...new Set(
                [...accounts, ...agents]
                    .map((item) => item.organizationId)
                    .filter((id): id is string => Boolean(id)),
            ),
        ];
        const assignedIds = [
            ...new Set(
                agents
                    .map((agent) => agent.assignedUserId)
                    .filter((id): id is string => Boolean(id)),
            ),
        ];

        const [organizations, assignees] = await Promise.all([
            organizationIds.length
                ? this.organizationRepository.find({
                      where: { id: In(organizationIds) },
                      select: ["id", "name"],
                  })
                : Promise.resolve([]),
            assignedIds.length
                ? this.userRepository.find({
                      where: { id: In(assignedIds) },
                      select: ["id", "username", "nickname", "realName"],
                  })
                : Promise.resolve([]),
        ]);
        const organizationName = new Map(organizations.map((item) => [item.id, item.name]));
        const assigneeName = new Map(
            assignees.map((user) => [user.id, user.realName || user.nickname || user.username]),
        );

        return {
            accounts: accounts.map((account) => ({
                id: account.id,
                label: account.label,
                status: account.status,
                organizationId: account.organizationId,
                organizationName: account.organizationId
                    ? (organizationName.get(account.organizationId) ?? "已删除组织")
                    : "个人空间",
                lastSyncAt: account.lastSyncAt,
                lastError: account.lastError,
                createdAt: account.createdAt,
            })),
            agents: agents.map((agent) => ({
                id: agent.id,
                name: agent.name,
                xiaozhiAccountId: agent.xiaozhiAccountId,
                organizationId: agent.organizationId,
                organizationName: agent.organizationId
                    ? (organizationName.get(agent.organizationId) ?? "已删除组织")
                    : "个人空间",
                deviceCount: agent.deviceCount,
                onlineDeviceCount: agent.onlineDeviceCount,
                lastConnectedAt: agent.lastConnectedAt,
                assignedUserId: agent.assignedUserId,
                assignedUserName: agent.assignedUserId
                    ? (assigneeName.get(agent.assignedUserId) ?? "已删除用户")
                    : null,
            })),
        };
    }

    /** 全站教学资产：场景 / 快捷指令 / 课堂活动。 */
    async listAssets(organizationId?: string) {
        const where = organizationId ? { organizationId } : {};
        const [scenes, commands, interactions] = await Promise.all([
            this.sceneRepository.find({ where, order: { updatedAt: "DESC" }, take: 500 }),
            this.commandRepository.find({ where, order: { updatedAt: "DESC" }, take: 500 }),
            this.interactionRepository.find({ where, order: { updatedAt: "DESC" }, take: 500 }),
        ]);

        const organizationIds = [
            ...new Set(
                [...scenes, ...commands, ...interactions]
                    .map((item) => item.organizationId)
                    .filter((id): id is string => Boolean(id)),
            ),
        ];
        const ownerIds = [
            ...new Set([...scenes, ...commands, ...interactions].map((item) => item.ownerUserId)),
        ];

        const [organizations, owners] = await Promise.all([
            organizationIds.length
                ? this.organizationRepository.find({
                      where: { id: In(organizationIds) },
                      select: ["id", "name"],
                  })
                : Promise.resolve([]),
            ownerIds.length
                ? this.userRepository.find({
                      where: { id: In(ownerIds) },
                      select: ["id", "username", "nickname", "realName"],
                  })
                : Promise.resolve([]),
        ]);
        const organizationName = new Map(organizations.map((item) => [item.id, item.name]));
        const ownerName = new Map(
            owners.map((user) => [user.id, user.realName || user.nickname || user.username]),
        );

        const decorate = <T extends { organizationId: string | null; ownerUserId: string }>(
            item: T,
        ) => ({
            organizationName: item.organizationId
                ? (organizationName.get(item.organizationId) ?? "已删除组织")
                : "个人空间",
            ownerName: ownerName.get(item.ownerUserId) ?? "未知",
        });

        return {
            scenes: scenes.map((scene) => ({
                id: scene.id,
                name: scene.name,
                description: scene.description,
                updatedAt: scene.updatedAt,
                ...decorate(scene),
            })),
            quickCommands: commands.map((command) => ({
                id: command.id,
                name: command.name,
                sceneId: command.sceneId,
                targetCount: command.targets?.length ?? 0,
                updatedAt: command.updatedAt,
                ...decorate(command),
            })),
            interactions: interactions.map((interaction) => ({
                id: interaction.id,
                name: interaction.name,
                status: interaction.status,
                targetCount: interaction.targets?.length ?? 0,
                updatedAt: interaction.updatedAt,
                ...decorate(interaction),
            })),
        };
    }

    async topupQuota(operatorUserId: string, organizationId: string, dto: TopupQuotaDto) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) throw HttpErrorFactory.notFound("组织不存在");
        return this.quotaService.topup(operatorUserId, organizationId, dto);
    }

    /** 后台创建组织时选择负责人：只在有个人空间的正常账号里挑。 */
    async searchOwnerCandidates(keyword?: string) {
        const trimmed = keyword?.trim();
        const base = { hasPersonalWorkspace: true, status: 1, isRoot: 0 } as const;
        return this.userRepository.find({
            where: trimmed
                ? [
                      { ...base, username: Like(`%${trimmed}%`) },
                      { ...base, nickname: Like(`%${trimmed}%`) },
                      { ...base, realName: Like(`%${trimmed}%`) },
                  ]
                : base,
            select: ["id", "username", "nickname", "realName", "avatar"],
            take: 20,
            order: { createdAt: "DESC" },
        });
    }
}
