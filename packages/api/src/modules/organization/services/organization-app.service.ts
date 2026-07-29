import { ExtensionStatus } from "@buildingai/constants/shared/extension.constant";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    AiWorkflow,
    Extension,
    Organization,
    OrganizationAppGrant,
    OrganizationAppType,
    type OrganizationAppTypeValue,
} from "@buildingai/db/entities";
import { IsNull, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { OrganizationPermission } from "../constants/organization-permissions";
import type { SaveAppGrantsDto, UpdateAppWhitelistDto } from "../dto/app-grant.dto";
import { OrganizationService } from "./organization.service";

/** 授权矩阵里的一行：一个可授权的应用。 */
export type GrantableApp = {
    appType: OrganizationAppTypeValue;
    appRefId: string;
    name: string;
    description: string;
    icon: string | null;
    /** 已被整班授权。 */
    grantedToClass: boolean;
    /** 单独授权到的学生ID列表。 */
    grantedUserIds: string[];
};

function grantKey(appType: string, appRefId: string, userId: string | null) {
    return `${appType}:${appRefId}:${userId ?? "*"}`;
}

@Injectable()
export class OrganizationAppService {
    constructor(
        @InjectRepository(OrganizationAppGrant)
        private readonly grantRepository: Repository<OrganizationAppGrant>,
        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,
        @InjectRepository(Extension)
        private readonly extensionRepository: Repository<Extension>,
        @InjectRepository(AiWorkflow)
        private readonly workflowRepository: Repository<AiWorkflow>,
        private readonly organizationService: OrganizationService,
    ) {}

    private async resolveOrganization(organizationId: string) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) throw HttpErrorFactory.notFound("组织不存在");
        return organization;
    }

    /** 可授权的应用来源：已启用的应用中心插件 + 老师发布过的工作流。 */
    private async listGrantableApps(teacherUserId: string) {
        const [extensions, workflows] = await Promise.all([
            this.extensionRepository.find({
                where: { status: ExtensionStatus.ENABLED },
                select: [
                    "id",
                    "name",
                    "alias",
                    "aliasDescription",
                    "description",
                    "icon",
                    "aliasIcon",
                ],
                order: { appCenterSort: "ASC", createdAt: "DESC" },
            }),
            this.workflowRepository.find({
                where: { createBy: teacherUserId, isPublished: true },
                select: ["id", "name", "description"],
                order: { createdAt: "DESC" },
            }),
        ]);

        return [
            ...extensions.map((extension) => ({
                appType: OrganizationAppType.EXTENSION as OrganizationAppTypeValue,
                appRefId: extension.id,
                name: extension.alias || extension.name,
                description: extension.aliasDescription || extension.description || "",
                icon: extension.aliasIcon || extension.icon || null,
            })),
            ...workflows.map((workflow) => ({
                appType: OrganizationAppType.WORKFLOW as OrganizationAppTypeValue,
                appRefId: workflow.id,
                name: workflow.name,
                description: workflow.description || "",
                icon: null,
            })),
        ];
    }

    /** 老师视角：应用 × 成员的授权矩阵。 */
    async getGrantMatrix(userId: string, organizationId: string) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.ASSET_MANAGE,
        );

        const organization = await this.resolveOrganization(organizationId);
        const [apps, grants] = await Promise.all([
            this.listGrantableApps(userId),
            this.grantRepository.find({ where: { organizationId } }),
        ]);

        const classGrants = new Set<string>();
        const userGrants = new Map<string, string[]>();
        for (const grant of grants) {
            const key = `${grant.appType}:${grant.appRefId}`;
            if (grant.userId) {
                userGrants.set(key, [...(userGrants.get(key) ?? []), grant.userId]);
            } else {
                classGrants.add(key);
            }
        }

        const items: GrantableApp[] = apps.map((app) => {
            const key = `${app.appType}:${app.appRefId}`;
            return {
                ...app,
                grantedToClass: classGrants.has(key),
                grantedUserIds: userGrants.get(key) ?? [],
            };
        });

        return { whitelistEnabled: organization.appWhitelistEnabled, items };
    }

    /**
     * 全量覆盖式写入授权：传入的集合即为最终状态，
     * 未出现的旧记录会被删除，避免前端逐条 diff。
     */
    async saveGrants(userId: string, organizationId: string, dto: SaveAppGrantsDto) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.ASSET_MANAGE,
        );

        const members = await this.organizationService.listMemberUserIds(organizationId);
        const memberIds = new Set(members);
        const invalid = dto.grants.find((grant) => grant.userId && !memberIds.has(grant.userId));
        if (invalid) throw HttpErrorFactory.badRequest("存在不属于本组织的成员");

        return this.grantRepository.manager.transaction(async (manager) => {
            const repository = manager.getRepository(OrganizationAppGrant);
            const existing = await repository.find({ where: { organizationId } });
            const existingByKey = new Map(
                existing.map((grant) => [
                    grantKey(grant.appType, grant.appRefId, grant.userId),
                    grant,
                ]),
            );

            const desiredKeys = new Set(
                dto.grants.map((grant) =>
                    grantKey(grant.appType, grant.appRefId, grant.userId ?? null),
                ),
            );

            const toRemove = existing.filter(
                (grant) => !desiredKeys.has(grantKey(grant.appType, grant.appRefId, grant.userId)),
            );
            if (toRemove.length) await repository.remove(toRemove);

            const toCreate = dto.grants
                .filter(
                    (grant) =>
                        !existingByKey.has(
                            grantKey(grant.appType, grant.appRefId, grant.userId ?? null),
                        ),
                )
                .map((grant) =>
                    repository.create({
                        organizationId,
                        userId: grant.userId ?? null,
                        appType: grant.appType,
                        appRefId: grant.appRefId,
                        grantedByUserId: userId,
                    }),
                );
            if (toCreate.length) await repository.save(toCreate);

            return { granted: dto.grants.length, revoked: toRemove.length };
        });
    }

    async updateWhitelist(userId: string, organizationId: string, dto: UpdateAppWhitelistDto) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.ASSET_MANAGE,
        );
        const organization = await this.resolveOrganization(organizationId);
        organization.appWhitelistEnabled = dto.enabled;
        await this.organizationRepository.save(organization);
        return { enabled: organization.appWhitelistEnabled };
    }

    /**
     * 学生视角：返回当前组织对我可见的应用。
     * 白名单未开启时 `restricted` 为 false，前端沿用全站应用中心不做过滤。
     */
    async listMine(userId: string, organizationId: string) {
        const access = await this.organizationService.requireWorkspace(userId, organizationId);
        const organization = await this.resolveOrganization(organizationId);

        // 老师/管理员自己不受白名单限制，否则没法验证授权效果。
        const canManage = access.permissions.includes(OrganizationPermission.ASSET_MANAGE);
        if (!organization.appWhitelistEnabled || canManage) {
            return { restricted: false, extensionIds: [], workflowIds: [] };
        }

        const grants = await this.grantRepository.find({
            where: [
                { organizationId, userId },
                { organizationId, userId: IsNull() },
            ],
        });

        return {
            restricted: true,
            extensionIds: grants
                .filter((grant) => grant.appType === OrganizationAppType.EXTENSION)
                .map((grant) => grant.appRefId),
            workflowIds: grants
                .filter((grant) => grant.appType === OrganizationAppType.WORKFLOW)
                .map((grant) => grant.appRefId),
        };
    }
}
