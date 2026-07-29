import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    ClassroomAppSession,
    Organization,
    OrganizationMember,
    User,
    XiaozhiAgentBinding,
    XiaozhiMcpConnection,
} from "@buildingai/db/entities";
import { Global, Module } from "@nestjs/common";

import { ClassroomKitService } from "./classroom-kit.service";
import { ClassroomToolRegistryService } from "./classroom-tool-registry.service";

/**
 * 课堂能力模块（全局）。
 *
 * 提供两样东西：应用 MCP 工具注册表，以及读班级/读设备/写提示词/接管归还的
 * 能力层。之所以做成 `@Global()`：方糖猫 MCP 网关与已安装的课堂应用必须拿到
 * **同一个**注册表实例，否则应用注册的工具网关看不见。和 BillingModule 同样
 * 只需在根模块引入一次。
 *
 * 能力层还需要 api 层注入 `ClassroomWorkspacePort`（权限判定与配置下发），
 * 未注入时相关方法会明确报错而不是静默失败。
 */
@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            ClassroomAppSession,
            Organization,
            OrganizationMember,
            User,
            XiaozhiAgentBinding,
            XiaozhiMcpConnection,
        ]),
    ],
    providers: [ClassroomToolRegistryService, ClassroomKitService],
    exports: [ClassroomToolRegistryService, ClassroomKitService],
})
export class ClassroomKitModule {}
