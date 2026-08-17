import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    XiaomiHomeAccount,
    XiaomiHomeDevice,
    XiaomiHomeOAuthSession,
} from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { XiaomiHomeController } from "./xiaomi-home.controller";
import { XiaomiHomeService } from "./xiaomi-home.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([XiaomiHomeAccount, XiaomiHomeOAuthSession, XiaomiHomeDevice]),
    ],
    controllers: [XiaomiHomeController],
    providers: [XiaomiHomeService],
    exports: [XiaomiHomeService],
})
export class SmartHomeModule {}
