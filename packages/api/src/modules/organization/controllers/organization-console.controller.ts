import { BaseController } from "@buildingai/base";
import { type UserPlayground } from "@buildingai/db";
import { BuildFileUrl } from "@buildingai/decorators/file-url.decorator";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { ConsoleController } from "@common/decorators/controller.decorator";
import { Permissions } from "@common/decorators/permissions.decorator";
import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";

import {
    ConsoleCreateOrganizationDto,
    ConsoleTeachingQueryDto,
    ConsoleUpdateMemberRolesDto,
    ConsoleUpdateOrganizationDto,
} from "../dto/organization-console.dto";
import { TopupQuotaDto } from "../dto/quota.dto";
import { OrganizationConsoleService } from "../services/organization-console.service";

/**
 * 管理员工作台 · 教学管理
 *
 * 与讲台（老师视角、限定单个班级）不同，这里的接口是跨组织的全局视图，
 * 由后台 RBAC 控制访问。
 */
@ConsoleController("teaching", "教学管理")
export class OrganizationConsoleController extends BaseController {
    constructor(private readonly consoleService: OrganizationConsoleService) {
        super();
    }

    @Get("organizations")
    @Permissions({
        code: "organization-list",
        name: "查看组织列表",
        description: "查看全部教学组织及其成员、设备与额度概况",
    })
    listOrganizations(@Query() query: ConsoleTeachingQueryDto) {
        return this.consoleService.listOrganizations(query.keyword);
    }

    @Post("organizations")
    @Permissions({
        code: "organization-create",
        name: "创建组织",
        description: "在后台创建教学组织并指定负责人",
    })
    createOrganization(
        @Playground() user: UserPlayground,
        @Body() dto: ConsoleCreateOrganizationDto,
    ) {
        return this.consoleService.createOrganization(user.id, dto);
    }

    @Patch("organizations/:organizationId")
    @Permissions({
        code: "organization-update",
        name: "更新组织",
        description: "修改组织名称、启停状态与应用白名单开关",
    })
    updateOrganization(
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @Body() dto: ConsoleUpdateOrganizationDto,
    ) {
        return this.consoleService.updateOrganization(organizationId, dto);
    }

    @Get("organizations/:organizationId/members")
    @Permissions({
        code: "member-list",
        name: "查看组织成员",
        description: "查看指定组织的成员与身份",
    })
    @BuildFileUrl(["**.avatar"])
    listMembers(@Param("organizationId", UUIDValidationPipe) organizationId: string) {
        return this.consoleService.listMembers(organizationId);
    }

    @Patch("organizations/:organizationId/members/:memberId")
    @Permissions({
        code: "member-update",
        name: "分配组织身份",
        description: "调整组织成员在班级中的身份",
    })
    updateMemberRoles(
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @Param("memberId", UUIDValidationPipe) memberId: string,
        @Body() dto: ConsoleUpdateMemberRolesDto,
    ) {
        return this.consoleService.updateMemberRoles(organizationId, memberId, dto.roles);
    }

    @Delete("organizations/:organizationId/members/:memberId")
    @Permissions({
        code: "member-remove",
        name: "移出组织成员",
        description: "将成员从组织中移除",
    })
    removeMember(
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @Param("memberId", UUIDValidationPipe) memberId: string,
    ) {
        return this.consoleService.removeMember(organizationId, memberId);
    }

    @Post("organizations/:organizationId/quota/topup")
    @Permissions({
        code: "quota-topup",
        name: "班级额度充值",
        description: "给班级额度池充值，老师再从池中划拨给学生",
    })
    topupQuota(
        @Playground() user: UserPlayground,
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @Body() dto: TopupQuotaDto,
    ) {
        return this.consoleService.topupQuota(user.id, organizationId, dto);
    }

    @Get("owner-candidates")
    @Permissions({
        code: "owner-candidates",
        name: "搜索组织负责人",
        description: "搜索可作为组织负责人的账号",
    })
    @BuildFileUrl(["**.avatar"])
    searchOwnerCandidates(@Query() query: ConsoleTeachingQueryDto) {
        return this.consoleService.searchOwnerCandidates(query.keyword);
    }

    @Get("devices")
    @Permissions({
        code: "device-list",
        name: "查看全部方糖猫",
        description: "跨组织查看方糖猫账号、智能体与设备分发情况",
    })
    listDevices(@Query() query: ConsoleTeachingQueryDto) {
        return this.consoleService.listDevices(query.organizationId);
    }

    @Get("assets")
    @Permissions({
        code: "asset-list",
        name: "查看教学资产",
        description: "跨组织查看老师创建的场景、快捷指令与课堂活动",
    })
    listAssets(@Query() query: ConsoleTeachingQueryDto) {
        return this.consoleService.listAssets(query.organizationId);
    }
}
