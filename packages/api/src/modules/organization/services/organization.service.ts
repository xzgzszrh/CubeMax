import { UserCreateSource } from "@buildingai/constants";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    Organization,
    OrganizationMember,
    OrganizationMemberType,
    OrganizationRole,
    type OrganizationRoleType,
    User,
} from "@buildingai/db/entities";
import { In, Like, Not, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { UserService } from "@modules/user/services/user.service";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import * as XLSX from "xlsx";

import {
    OrganizationPermission,
    type OrganizationPermissionType,
    resolveOrganizationPermissions,
} from "../constants/organization-permissions";
import {
    type AddOrganizationMemberDto,
    type CreateManagedAccountDto,
    type CreateOrganizationDto,
} from "../dto/organization.dto";

export type WorkspaceAccess = {
    type: "personal" | "organization";
    organizationId: string | null;
    roles: OrganizationRoleType[];
    permissions: OrganizationPermissionType[];
    member: OrganizationMember | null;
};

@Injectable()
export class OrganizationService {
    constructor(
        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,
        @InjectRepository(OrganizationMember)
        private readonly memberRepository: Repository<OrganizationMember>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly userService: UserService,
    ) {}

    async getContext(userId: string) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ["id", "hasPersonalWorkspace"],
        });
        if (!user) throw HttpErrorFactory.notFound("用户不存在");

        const memberships = await this.memberRepository.find({
            where: { userId },
            order: { createdAt: "ASC" },
        });
        const organizations = memberships.length
            ? await this.organizationRepository.find({
                  where: { id: In(memberships.map((item) => item.organizationId)), isActive: true },
              })
            : [];
        const organizationMap = new Map(organizations.map((item) => [item.id, item]));

        return {
            personalWorkspace: user.hasPersonalWorkspace
                ? {
                      id: null,
                      type: "personal" as const,
                      name: "个人空间",
                      roles: [] as OrganizationRoleType[],
                      permissions: Object.values(OrganizationPermission),
                  }
                : null,
            organizations: memberships
                .map((member) => {
                    const organization = organizationMap.get(member.organizationId);
                    if (!organization) return null;
                    return {
                        id: organization.id,
                        type: "organization" as const,
                        name: organization.name,
                        code: organization.code,
                        roles: member.roles,
                        permissions: resolveOrganizationPermissions(member.roles),
                        memberType: member.memberType,
                        canLeave: member.canLeave,
                    };
                })
                .filter(Boolean),
        };
    }

    async requireWorkspace(
        userId: string,
        organizationId?: string | null,
        permission?: OrganizationPermissionType,
    ): Promise<WorkspaceAccess> {
        if (
            organizationId &&
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                organizationId,
            )
        ) {
            throw HttpErrorFactory.badRequest("组织ID格式不正确");
        }
        if (!organizationId) {
            const user = await this.userRepository.findOne({
                where: { id: userId, hasPersonalWorkspace: true },
                select: ["id"],
            });
            if (!user) throw HttpErrorFactory.forbidden("该账号不具备个人空间权限");
            return {
                type: "personal",
                organizationId: null,
                roles: [],
                permissions: Object.values(OrganizationPermission),
                member: null,
            };
        }

        const member = await this.memberRepository.findOne({
            where: { organizationId, userId },
        });
        if (!member) throw HttpErrorFactory.forbidden("你不是该组织的成员");

        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId, isActive: true },
            select: ["id"],
        });
        if (!organization) throw HttpErrorFactory.notFound("组织不存在或已停用");

        const permissions = resolveOrganizationPermissions(member.roles);
        if (permission && !permissions.includes(permission)) {
            throw HttpErrorFactory.forbidden("当前组织身份没有执行此操作的权限");
        }
        return {
            type: "organization",
            organizationId,
            roles: member.roles,
            permissions,
            member,
        };
    }

    async create(userId: string, dto: CreateOrganizationDto) {
        await this.requireWorkspace(userId, null);

        return this.organizationRepository.manager.transaction(async (manager) => {
            let code = "";
            for (let attempts = 0; attempts < 5; attempts += 1) {
                code = randomBytes(4).toString("hex").toUpperCase();
                const exists = await manager.exists(Organization, { where: { code } });
                if (!exists) break;
            }

            const organization = await manager.save(
                manager.create(Organization, {
                    name: dto.name.trim(),
                    code,
                    ownerId: userId,
                    isActive: true,
                }),
            );
            await manager.save(
                manager.create(OrganizationMember, {
                    organizationId: organization.id,
                    userId,
                    roles: [OrganizationRole.ADMIN],
                    memberType: OrganizationMemberType.OWNER,
                    canLeave: false,
                }),
            );
            return organization;
        });
    }

    async listMembers(userId: string, organizationId: string, keyword?: string) {
        await this.requireWorkspace(userId, organizationId, OrganizationPermission.MEMBER_READ);

        const query = this.memberRepository
            .createQueryBuilder("member")
            .innerJoin(User, "user", 'user.id = member.user_id AND user.deleted_at IS NULL')
            .where("member.organization_id = :organizationId", { organizationId })
            .andWhere("member.deleted_at IS NULL")
            .select([
                "member.id AS id",
                'member.user_id AS "userId"',
                "member.roles AS roles",
                'member.member_type AS "memberType"',
                'member.can_leave AS "canLeave"',
                'member.created_at AS "createdAt"',
                "user.username AS username",
                "user.nickname AS nickname",
                'user.real_name AS "realName"',
                "user.avatar AS avatar",
                'user.has_personal_workspace AS "hasPersonalWorkspace"',
            ])
            .orderBy("member.created_at", "ASC");

        if (keyword?.trim()) {
            query.andWhere(
                "(user.username ILIKE :keyword OR user.nickname ILIKE :keyword OR user.real_name ILIKE :keyword)",
                { keyword: `%${keyword.trim()}%` },
            );
        }
        return query.getRawMany();
    }

    async searchPersonalUsers(userId: string, organizationId: string, keyword?: string) {
        await this.requireWorkspace(userId, organizationId, OrganizationPermission.MEMBER_MANAGE);
        const existing = await this.memberRepository.find({
            where: { organizationId },
            select: ["userId"],
        });
        const excludedIds = [userId, ...existing.map((item) => item.userId)];
        const base = {
            hasPersonalWorkspace: true,
            status: 1,
            id: Not(In(excludedIds)),
            isRoot: 0,
        } as const;
        const trimmedKeyword = keyword?.trim();
        return this.userRepository.find({
            where: trimmedKeyword
                ? [
                      { ...base, username: Like(`%${trimmedKeyword}%`) },
                      { ...base, nickname: Like(`%${trimmedKeyword}%`) },
                      { ...base, realName: Like(`%${trimmedKeyword}%`) },
                  ]
                : base,
            select: ["id", "username", "nickname", "realName", "avatar"],
            take: 20,
            order: { createdAt: "DESC" },
        });
    }

    async addMember(userId: string, organizationId: string, dto: AddOrganizationMemberDto) {
        await this.requireWorkspace(userId, organizationId, OrganizationPermission.MEMBER_MANAGE);
        const target = await this.userRepository.findOne({
            where: { id: dto.userId, hasPersonalWorkspace: true, status: 1 },
            select: ["id"],
        });
        if (!target) throw HttpErrorFactory.badRequest("只能添加具备个人账号权限的普通账号");
        const exists = await this.memberRepository.findOne({
            where: { organizationId, userId: dto.userId },
        });
        if (exists) throw HttpErrorFactory.conflict("该账号已在组织中");

        return this.memberRepository.save(
            this.memberRepository.create({
                organizationId,
                userId: dto.userId,
                roles: dto.roles,
                memberType: OrganizationMemberType.INVITED,
                canLeave: true,
            }),
        );
    }

    async updateMemberRoles(
        userId: string,
        organizationId: string,
        memberId: string,
        roles: OrganizationRoleType[],
    ) {
        await this.requireWorkspace(userId, organizationId, OrganizationPermission.MEMBER_MANAGE);
        const member = await this.memberRepository.findOne({
            where: { id: memberId, organizationId },
        });
        if (!member) throw HttpErrorFactory.notFound("组织成员不存在");
        if (member.memberType === OrganizationMemberType.OWNER) {
            throw HttpErrorFactory.forbidden("组织创建人的管理员身份不能移除");
        }
        member.roles = roles;
        return this.memberRepository.save(member);
    }

    async leave(userId: string, organizationId: string) {
        const access = await this.requireWorkspace(userId, organizationId);
        if (!access.member?.canLeave || access.member.memberType !== OrganizationMemberType.INVITED) {
            throw HttpErrorFactory.forbidden("托管子账号和组织创建人不能主动退出组织");
        }
        await this.memberRepository.softRemove(access.member);
        return { success: true };
    }

    async createManagedAccounts(
        userId: string,
        organizationId: string,
        accounts: CreateManagedAccountDto[],
    ) {
        await this.requireWorkspace(userId, organizationId, OrganizationPermission.MEMBER_MANAGE);
        const managedCount = await this.memberRepository.count({
            where: { organizationId, memberType: OrganizationMemberType.MANAGED },
        });
        if (managedCount + accounts.length > 100) {
            throw HttpErrorFactory.badRequest("每个组织最多创建100个托管子账号");
        }

        const normalized = accounts.map((item) => ({
            username: item.username?.trim(),
            nickname: item.nickname?.trim() || item.realName?.trim() || item.username?.trim(),
            realName: item.realName?.trim() || undefined,
            password: item.password?.trim() || undefined,
        }));
        this.validateManagedAccounts(normalized);

        const usernames = normalized.map((item) => item.username);
        if (new Set(usernames).size !== usernames.length) {
            throw HttpErrorFactory.badRequest("批量数据中存在重复用户名");
        }
        const existing = await this.userRepository.find({
            where: { username: In(usernames) },
            select: ["username"],
        });
        if (existing.length) {
            throw HttpErrorFactory.conflict(
                `以下用户名已存在：${existing.map((item) => item.username).join("、")}`,
            );
        }

        return this.userRepository.manager.transaction(async (manager) => {
            const credentials: Array<{
                userId: string;
                username: string;
                nickname: string;
                password: string;
            }> = [];

            for (const [index, item] of normalized.entries()) {
                const password = item.password || (await this.userService.generateRandomPassword(12));
                const user = await manager.save(
                    manager.create(User, {
                        username: item.username,
                        nickname: item.nickname,
                        realName: item.realName,
                        password: await this.userService.hashPassword(password),
                        source: UserCreateSource.CONSOLE,
                        userNo: `ORG${randomBytes(8).toString("hex").toUpperCase()}${index}`,
                        avatar: `/static/avatars/${Math.floor(Math.random() * 33) + 1}.png`,
                        status: 1,
                        isRoot: 0,
                        hasPersonalWorkspace: false,
                    }),
                );
                await manager.save(
                    manager.create(OrganizationMember, {
                        organizationId,
                        userId: user.id,
                        roles: [OrganizationRole.STUDENT],
                        memberType: OrganizationMemberType.MANAGED,
                        canLeave: false,
                    }),
                );
                credentials.push({
                    userId: user.id,
                    username: user.username,
                    nickname: user.nickname,
                    password,
                });
            }
            return { created: credentials.length, credentials };
        });
    }

    async importManagedAccounts(userId: string, organizationId: string, file?: Express.Multer.File) {
        if (!file?.buffer?.length) throw HttpErrorFactory.badRequest("请选择CSV或Excel文件");
        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.read(file.buffer, { type: "buffer" });
        } catch {
            throw HttpErrorFactory.badRequest("无法解析导入文件");
        }
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw HttpErrorFactory.badRequest("导入文件没有可用工作表");
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (!rows.length) throw HttpErrorFactory.badRequest("导入文件没有账号数据");
        if (rows.length > 100) throw HttpErrorFactory.badRequest("一次最多导入100个账号");

        const accounts = rows.map((row) => ({
            username: String(row.username || row["用户名"] || ""),
            nickname: String(row.nickname || row["昵称"] || row["姓名"] || ""),
            realName: String(row.realName || row["真实姓名"] || row["姓名"] || "") || undefined,
            password: String(row.password || row["密码"] || "") || undefined,
        }));
        return this.createManagedAccounts(userId, organizationId, accounts);
    }

    private validateManagedAccounts(accounts: CreateManagedAccountDto[]) {
        for (const [index, item] of accounts.entries()) {
            const row = index + 1;
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(item.username || "")) {
                throw HttpErrorFactory.badRequest(`第${row}行用户名须为3-20位字母、数字或下划线`);
            }
            if (!item.nickname || item.nickname.length < 2 || item.nickname.length > 20) {
                throw HttpErrorFactory.badRequest(`第${row}行昵称须为2-20个字符`);
            }
            if (item.password && !/^(?=.*[a-zA-Z])(?=.*\d).{6,20}$/.test(item.password)) {
                throw HttpErrorFactory.badRequest(`第${row}行密码须为6-20位且包含字母和数字`);
            }
        }
    }

    async assertAssignableMember(organizationId: string, targetUserId: string) {
        const member = await this.memberRepository.findOne({
            where: { organizationId, userId: targetUserId },
        });
        if (!member) {
            throw HttpErrorFactory.badRequest("方糖猫只能分发给本组织的成员");
        }
        return member;
    }
}
