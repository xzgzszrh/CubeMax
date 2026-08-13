import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AiModel, LuaModule } from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { SimulatorModule } from "../simulator/simulator.module";
import { LuaCodeAssistantService } from "./lua-code-assistant.service";
import { LuaModuleController } from "./lua-module.controller";
import { LuaModuleService } from "./lua-module.service";
import { LuaRuntimeService } from "./lua-runtime.service";

@Module({
    imports: [TypeOrmModule.forFeature([LuaModule, AiModel]), SimulatorModule],
    controllers: [LuaModuleController],
    providers: [LuaModuleService, LuaRuntimeService, LuaCodeAssistantService],
    exports: [LuaModuleService],
})
export class LuaModuleModule {}
