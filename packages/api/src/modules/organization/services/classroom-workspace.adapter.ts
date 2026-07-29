import {
    type ClassroomKitPermissionType,
    ClassroomKitService,
    ClassroomWorkspacePort,
} from "@buildingai/core/modules/classroom";
import { Injectable, type OnModuleInit } from "@nestjs/common";

import type { OrganizationPermissionType } from "../constants/organization-permissions";
import { OrganizationService } from "./organization.service";
import { XiaozhiService } from "./xiaozhi.service";

/**
 * 把 ClassroomKit 的外部依赖接到真实实现上。
 *
 * core 里的能力层只声明了「怎样算有权限」「怎样把配置发到设备」两个端口，
 * 因为这两件事的实现都在 api 层：权限判定属于组织模块，配置下发要用到
 * `XiaozhiService` 里加密保存的上游账号凭据。core 不能反向依赖 api，
 * 所以在这里实现并于启动时注入。
 */
@Injectable()
export class ClassroomWorkspaceAdapter extends ClassroomWorkspacePort implements OnModuleInit {
    constructor(
        private readonly organizationService: OrganizationService,
        private readonly xiaozhiService: XiaozhiService,
        private readonly classroomKit: ClassroomKitService,
    ) {
        super();
    }

    onModuleInit() {
        this.classroomKit.useWorkspacePort(this);
    }

    async requireWorkspace(
        userId: string,
        organizationId: string | null | undefined,
        permission?: ClassroomKitPermissionType,
    ) {
        // core 侧的权限字面量与 OrganizationPermission 取值一致，
        // organization-permissions.spec.ts 里有断言守着这一点。
        const access = await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            permission as OrganizationPermissionType | undefined,
        );
        return {
            type: access.type,
            organizationId: access.organizationId,
            permissions: access.permissions as string[],
        };
    }

    async readDeviceConfig(
        userId: string,
        organizationId: string | null | undefined,
        agentBindingId: string,
    ) {
        const { config } = await this.xiaozhiService.captureAgentConfig(
            userId,
            organizationId,
            agentBindingId,
        );
        return config;
    }

    async writeDeviceConfig(
        userId: string,
        organizationId: string | null | undefined,
        agentBindingId: string,
        config: Record<string, unknown>,
    ) {
        await this.xiaozhiService.updateAgentConfig(userId, organizationId, agentBindingId, config);
    }
}
