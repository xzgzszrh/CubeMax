import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    LuaDeviceConnection,
    LuaDeviceRun,
    LuaDeviceRunLog,
    LuaPhysicalDevice,
} from "@buildingai/db/entities/lua-device.entity";
import { Module } from "@nestjs/common";

import { LuaDeviceController } from "./lua-device.controller";
import { LuaDeviceGatewayService } from "./lua-device-gateway.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            LuaPhysicalDevice,
            LuaDeviceConnection,
            LuaDeviceRun,
            LuaDeviceRunLog,
        ]),
    ],
    controllers: [LuaDeviceController],
    providers: [LuaDeviceGatewayService],
    exports: [LuaDeviceGatewayService],
})
export class LuaDeviceModule {}
