import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";

import { CreateLuaModuleDto, QueryLuaModuleDto } from "../lua/lua-module.dto";
import { CreateSimulatorSessionDto } from "../simulator/simulator.dto";
import {
    CreateProgrammingProjectDto,
    ImportProgrammingProjectLuaDto,
    QueryProgrammingProjectDto,
    ReplaceProgrammingProjectToolsDto,
    UpdateProgrammingProjectDto,
} from "./programming-project.dto";
import { ProgrammingProjectService } from "./programming-project.service";

@WebController("programming-projects")
export class ProgrammingProjectController {
    constructor(private readonly programmingProjectService: ProgrammingProjectService) {}

    @Get()
    list(@Playground() user: UserPlayground, @Query() query: QueryProgrammingProjectDto) {
        return this.programmingProjectService.findAll(user.id, query);
    }

    @Post()
    create(@Playground() user: UserPlayground, @Body() dto: CreateProgrammingProjectDto) {
        return this.programmingProjectService.create(user.id, dto);
    }

    @Get(":id/lua-modules")
    listLuaModules(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Query() query: QueryLuaModuleDto,
    ) {
        return this.programmingProjectService.listLuaModules(user.id, id, query);
    }

    @Post(":id/lua-modules")
    createLuaModule(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: CreateLuaModuleDto,
    ) {
        return this.programmingProjectService.createLuaModule(user.id, id, dto);
    }

    @Get(":id/unassigned-lua-modules")
    listUnassignedLuaModules(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.programmingProjectService.listUnassignedLuaModules(user.id, id);
    }

    @Post(":id/import-lua-module")
    importLuaModule(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: ImportProgrammingProjectLuaDto,
    ) {
        return this.programmingProjectService.importLuaModule(user.id, id, dto.moduleId);
    }

    @Get(":id/simulator-sessions")
    listSimulatorSessions(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.programmingProjectService.listSimulatorSessions(user.id, id);
    }

    @Post(":id/simulator-sessions")
    createSimulatorSession(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: CreateSimulatorSessionDto,
    ) {
        return this.programmingProjectService.createSimulatorSession(
            user.id,
            id,
            dto.name,
            dto.boardType,
        );
    }

    @Put(":id/tools")
    replaceTools(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: ReplaceProgrammingProjectToolsDto,
    ) {
        return this.programmingProjectService.replaceTools(id, user.id, dto.tools);
    }

    @Post(":id/publish")
    publish(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.programmingProjectService.publish(id, user.id);
    }

    @Post(":id/unpublish")
    unpublish(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.programmingProjectService.unpublish(id, user.id);
    }

    @Get(":id")
    detail(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.programmingProjectService.findDetail(id, user.id);
    }

    @Patch(":id")
    update(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: UpdateProgrammingProjectDto,
    ) {
        return this.programmingProjectService.update(id, user.id, dto);
    }

    @Delete(":id")
    async remove(@Playground() user: UserPlayground, @Param("id") id: string) {
        await this.programmingProjectService.remove(id, user.id);
    }
}
