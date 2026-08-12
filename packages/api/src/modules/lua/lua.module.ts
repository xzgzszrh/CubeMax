import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { LuaModule } from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { LuaModuleController } from "./lua-module.controller";
import { LuaModuleService } from "./lua-module.service";
import { LuaRuntimeService } from "./lua-runtime.service";

@Module({
    imports: [TypeOrmModule.forFeature([LuaModule])],
    controllers: [LuaModuleController],
    providers: [LuaModuleService, LuaRuntimeService],
    exports: [LuaModuleService],
})
export class LuaModuleModule {}
