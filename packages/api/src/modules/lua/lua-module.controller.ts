import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";

import {
    CreateLuaModuleDto,
    QueryLuaModuleDto,
    TestLuaModuleDto,
    UpdateLuaModuleDto,
} from "./lua-module.dto";
import { LuaModuleService } from "./lua-module.service";

@WebController("lua-modules")
export class LuaModuleController {
    constructor(private readonly luaModuleService: LuaModuleService) {}

    @Get()
    findAll(@Playground() user: UserPlayground, @Query() query: QueryLuaModuleDto) {
        return this.luaModuleService.findAll(user.id, query);
    }

    @Post()
    create(@Playground() user: UserPlayground, @Body() dto: CreateLuaModuleDto) {
        return this.luaModuleService.create(user.id, dto);
    }

    @Get(":id")
    findOne(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.luaModuleService.findOne(id, user.id);
    }

    @Patch(":id")
    update(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: UpdateLuaModuleDto,
    ) {
        return this.luaModuleService.update(id, user.id, dto);
    }

    @Post(":id/test")
    test(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: TestLuaModuleDto,
    ) {
        return this.luaModuleService.test(id, user.id, dto.params ?? {}, dto.code);
    }

    @Post(":id/publish")
    publish(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.luaModuleService.publish(id, user.id);
    }

    @Post(":id/unpublish")
    unpublish(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.luaModuleService.unpublish(id, user.id);
    }

    @Delete(":id")
    async remove(@Playground() user: UserPlayground, @Param("id") id: string) {
        await this.luaModuleService.remove(id, user.id);
    }
}
