import {
    ACCOUNT_LOG_SOURCE,
    ACCOUNT_LOG_TYPE,
} from "@buildingai/constants/shared/account-log.constants";
import { AppBillingService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    AccountLog,
    Organization,
    OrganizationQuota,
    OrganizationQuotaLog,
    QuotaLogAction,
    User,
} from "@buildingai/db/entities";
import { In, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { OrganizationPermission } from "../constants/organization-permissions";
import type { AllocateQuotaDto, TopupQuotaDto } from "../dto/quota.dto";
import { OrganizationService } from "./organization.service";

/** 成员消耗统计的回溯窗口。 */
const CONSUMPTION_WINDOW_DAYS = 30;

@Injectable()
export class OrganizationQuotaService {
    constructor(
        @InjectRepository(OrganizationQuota)
        private readonly quotaRepository: Repository<OrganizationQuota>,
        @InjectRepository(OrganizationQuotaLog)
        private readonly quotaLogRepository: Repository<OrganizationQuotaLog>,
        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(AccountLog)
        private readonly accountLogRepository: Repository<AccountLog>,
        private readonly organizationService: OrganizationService,
        private readonly appBillingService: AppBillingService,
    ) {}

    /** 额度池按需创建，避免为每个历史组织补数据。 */
    async ensureQuota(organizationId: string) {
        const existing = await this.quotaRepository.findOne({ where: { organizationId } });
        if (existing) return existing;

        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) throw HttpErrorFactory.notFound("组织不存在");

        return this.quotaRepository.save(
            this.quotaRepository.create({
                organizationId,
                balance: 0,
                totalGranted: 0,
                totalAllocated: 0,
            }),
        );
    }

    /** 近 30 天各成员的积分消耗（account_log 中的扣减动作）。 */
    private async loadConsumption(userIds: string[]) {
        if (!userIds.length) return new Map<string, number>();

        const since = new Date();
        since.setDate(since.getDate() - CONSUMPTION_WINDOW_DAYS);

        const rows = await this.accountLogRepository
            .createQueryBuilder("log")
            .select("log.user_id", "userId")
            .addSelect("SUM(log.change_amount)", "amount")
            .where("log.user_id IN (:...userIds)", { userIds })
            .andWhere("log.action = 0")
            .andWhere("log.created_at >= :since", { since })
            .groupBy("log.user_id")
            .getRawMany<{ userId: string; amount: string }>();

        return new Map(rows.map((row) => [row.userId, Number(row.amount) || 0]));
    }

    async getOverview(userId: string, organizationId: string) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.QUOTA_ALLOCATE,
        );

        const quota = await this.ensureQuota(organizationId);
        const memberIds = await this.organizationService.listMemberUserIds(organizationId);

        const [users, consumption] = await Promise.all([
            memberIds.length
                ? this.userRepository.find({
                      where: { id: In(memberIds) },
                      select: ["id", "username", "nickname", "realName", "avatar", "power"],
                  })
                : Promise.resolve([]),
            this.loadConsumption(memberIds),
        ]);

        return {
            pool: {
                balance: quota.balance,
                totalGranted: quota.totalGranted,
                totalAllocated: quota.totalAllocated,
            },
            members: users.map((user) => ({
                userId: user.id,
                username: user.username,
                nickname: user.nickname,
                realName: user.realName,
                avatar: user.avatar,
                power: user.power,
                consumed: consumption.get(user.id) ?? 0,
            })),
        };
    }

    async listLogs(userId: string, organizationId: string) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.QUOTA_ALLOCATE,
        );

        const logs = await this.quotaLogRepository.find({
            where: { organizationId },
            order: { createdAt: "DESC" },
            take: 100,
        });
        const userIds = [
            ...new Set(
                logs.flatMap((log) =>
                    log.targetUserId
                        ? [log.targetUserId, log.operatorUserId]
                        : [log.operatorUserId],
                ),
            ),
        ];
        const users = userIds.length
            ? await this.userRepository.find({
                  where: { id: In(userIds) },
                  select: ["id", "nickname", "realName", "username"],
              })
            : [];
        const nameById = new Map(
            users.map((user) => [user.id, user.realName || user.nickname || user.username]),
        );

        return logs.map((log) => ({
            ...log,
            targetName: log.targetUserId ? (nameById.get(log.targetUserId) ?? "已删除用户") : null,
            operatorName: nameById.get(log.operatorUserId) ?? "未知",
        }));
    }

    /** 管理员给班级额度池充值，不涉及任何学生积分。 */
    async topup(operatorUserId: string, organizationId: string, dto: TopupQuotaDto) {
        await this.ensureQuota(organizationId);

        return this.quotaRepository.manager.transaction(async (manager) => {
            const quotaRepository = manager.getRepository(OrganizationQuota);
            const quota = await quotaRepository.findOne({ where: { organizationId } });
            if (!quota) throw HttpErrorFactory.notFound("班级额度池不存在");

            quota.balance += dto.amount;
            quota.totalGranted += dto.amount;
            await quotaRepository.save(quota);

            await manager.getRepository(OrganizationQuotaLog).save(
                manager.getRepository(OrganizationQuotaLog).create({
                    organizationId,
                    targetUserId: null,
                    action: QuotaLogAction.TOPUP,
                    amount: dto.amount,
                    balanceAfter: quota.balance,
                    operatorUserId,
                    remark: dto.remark?.trim() ?? "",
                }),
            );

            return { balance: quota.balance };
        });
    }

    /** 老师从班级额度池划拨给学生，学生侧走标准积分入账。 */
    async allocate(userId: string, organizationId: string, dto: AllocateQuotaDto) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.QUOTA_ALLOCATE,
        );
        await this.organizationService.assertAssignableMember(organizationId, dto.userId);
        await this.ensureQuota(organizationId);

        return this.quotaRepository.manager.transaction(async (manager) => {
            const quotaRepository = manager.getRepository(OrganizationQuota);
            const quota = await quotaRepository.findOne({ where: { organizationId } });
            if (!quota) throw HttpErrorFactory.notFound("班级额度池不存在");
            if (quota.balance < dto.amount) {
                throw HttpErrorFactory.badRequest("班级额度池余额不足");
            }

            quota.balance -= dto.amount;
            quota.totalAllocated += dto.amount;
            await quotaRepository.save(quota);

            await this.appBillingService.addUserPower(
                {
                    userId: dto.userId,
                    amount: dto.amount,
                    accountType: ACCOUNT_LOG_TYPE.SYSTEM_MANUAL_INC,
                    source: { type: ACCOUNT_LOG_SOURCE.SYSTEM, source: "班级额度划拨" },
                    remark: dto.remark?.trim() || "老师划拨班级额度",
                    associationUserId: userId,
                },
                manager,
            );

            await manager.getRepository(OrganizationQuotaLog).save(
                manager.getRepository(OrganizationQuotaLog).create({
                    organizationId,
                    targetUserId: dto.userId,
                    action: QuotaLogAction.ALLOCATE,
                    amount: dto.amount,
                    balanceAfter: quota.balance,
                    operatorUserId: userId,
                    remark: dto.remark?.trim() ?? "",
                }),
            );

            return { balance: quota.balance };
        });
    }

    /** 从学生处回收额度，回到班级额度池。 */
    async reclaim(userId: string, organizationId: string, dto: AllocateQuotaDto) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.QUOTA_ALLOCATE,
        );
        await this.organizationService.assertAssignableMember(organizationId, dto.userId);
        await this.ensureQuota(organizationId);

        const student = await this.userRepository.findOne({
            where: { id: dto.userId },
            select: ["id", "power"],
        });
        if (!student) throw HttpErrorFactory.notFound("学生不存在");
        if (student.power < dto.amount) {
            throw HttpErrorFactory.badRequest("学生剩余额度不足，无法回收");
        }

        return this.quotaRepository.manager.transaction(async (manager) => {
            const quotaRepository = manager.getRepository(OrganizationQuota);
            const quota = await quotaRepository.findOne({ where: { organizationId } });
            if (!quota) throw HttpErrorFactory.notFound("班级额度池不存在");

            await this.appBillingService.deductUserPower(
                {
                    userId: dto.userId,
                    amount: dto.amount,
                    accountType: ACCOUNT_LOG_TYPE.SYSTEM_MANUAL_DEC,
                    source: { type: ACCOUNT_LOG_SOURCE.SYSTEM, source: "班级额度回收" },
                    remark: dto.remark?.trim() || "老师回收班级额度",
                    associationUserId: userId,
                },
                manager,
            );

            quota.balance += dto.amount;
            quota.totalAllocated = Math.max(0, quota.totalAllocated - dto.amount);
            await quotaRepository.save(quota);

            await manager.getRepository(OrganizationQuotaLog).save(
                manager.getRepository(OrganizationQuotaLog).create({
                    organizationId,
                    targetUserId: dto.userId,
                    action: QuotaLogAction.RECLAIM,
                    amount: dto.amount,
                    balanceAfter: quota.balance,
                    operatorUserId: userId,
                    remark: dto.remark?.trim() ?? "",
                }),
            );

            return { balance: quota.balance };
        });
    }
}
