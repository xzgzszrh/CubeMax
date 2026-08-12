import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AiModel, LuaModule } from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { LuaModuleController } from "./lua-module.controller";
import { LuaCodeAssistantService } from "./lua-code-assistant.service";
import { LuaModuleService } from "./lua-module.service";
import { LuaRuntimeService } from "./lua-runtime.service";

@Module({
    imports: [TypeOrmModule.forFeature([LuaModule, AiModel])],
    controllers: [LuaModuleController],
    providers: [LuaModuleService, LuaRuntimeService, LuaCodeAssistantService],
    exports: [LuaModuleService],
})
export class LuaModuleModule {}
