import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    ClassroomEvent,
    ClassroomInteraction,
    Organization,
    OrganizationMember,
    User,
    XiaozhiAccount,
    XiaozhiAgentBinding,
    XiaozhiMcpConnection,
    XiaozhiMcpSettings,
    XiaozhiQuickCommand,
    XiaozhiScene,
} from "@buildingai/db/entities";
import { UserModule } from "@modules/user/user.module";
import { Module } from "@nestjs/common";

import { ClassroomPublicController } from "./controllers/classroom-public.controller";
import { OrganizationController } from "./controllers/organization.controller";
import { ClassroomService } from "./services/classroom.service";
import { OrganizationService } from "./services/organization.service";
import { XiaozhiAutomationService } from "./services/xiaozhi-automation.service";
import { XiaozhiMcpGatewayService, XiaozhiMcpService } from "./services/xiaozhi-mcp.service";
import { XiaozhiService } from "./services/xiaozhi.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Organization,
            OrganizationMember,
            User,
            XiaozhiAccount,
            XiaozhiAgentBinding,
            XiaozhiScene,
            XiaozhiQuickCommand,
            XiaozhiMcpConnection,
            XiaozhiMcpSettings,
            ClassroomInteraction,
            ClassroomEvent,
        ]),
        UserModule,
    ],
    controllers: [OrganizationController, ClassroomPublicController],
    providers: [
        OrganizationService,
        XiaozhiService,
        XiaozhiAutomationService,
        XiaozhiMcpGatewayService,
        XiaozhiMcpService,
        ClassroomService,
    ],
    exports: [OrganizationService, ClassroomService],
})
export class OrganizationModule {}
