import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    CameraCapture,
    CameraSession,
    File,
    MobileConnection,
    MobileInstallation,
} from "@buildingai/db/entities";
import { UploadModule as CoreUploadModule } from "@buildingai/core/modules";
import { AuthModule } from "@modules/auth/auth.module";
import { WsUpgradeModule } from "@common/ws/ws-upgrade.module";
import { Module } from "@nestjs/common";

import { CameraSessionService } from "./camera-session.service";
import { MobileClientRegistry } from "./mobile-client-registry";
import { MobileController } from "./mobile.controller";
import { MobileGatewayService } from "./mobile-gateway.service";

@Module({
    imports: [
        AuthModule,
        WsUpgradeModule,
        CoreUploadModule,
        TypeOrmModule.forFeature([
            MobileInstallation,
            MobileConnection,
            CameraSession,
            CameraCapture,
            File,
        ]),
    ],
    controllers: [MobileController],
    providers: [MobileClientRegistry, MobileGatewayService, CameraSessionService],
    exports: [CameraSessionService, MobileGatewayService],
})
export class MobileModule {}
