import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    XiaomiHomeAccount,
    XiaomiHomeDevice,
    XiaomiHomeOAuthSession,
    YeelightProAccount,
    YeelightProDevice,
    YeelightProQrSession,
} from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { XiaomiHomeController } from "./xiaomi-home.controller";
import { XiaomiHomeService } from "./xiaomi-home.service";
import { YeelightProController } from "./yeelight-pro.controller";
import { YeelightProService } from "./yeelight-pro.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            XiaomiHomeAccount,
            XiaomiHomeOAuthSession,
            XiaomiHomeDevice,
            YeelightProAccount,
            YeelightProQrSession,
            YeelightProDevice,
        ]),
    ],
    controllers: [XiaomiHomeController, YeelightProController],
    providers: [XiaomiHomeService, YeelightProService],
    exports: [XiaomiHomeService, YeelightProService],
})
export class SmartHomeModule {}
