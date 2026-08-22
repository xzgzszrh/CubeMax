import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";

import {
    CreateProgrammingTriggerDto,
    ExecuteProgrammingTriggerDto,
    QueryProgrammingTriggerDto,
    UpdateProgrammingTriggerDto,
} from "./programming-trigger.dto";
import { ProgrammingTriggerService } from "./programming-trigger.service";

@WebController("programming-triggers")
export class ProgrammingTriggerController {
    constructor(private readonly programmingTriggerService: ProgrammingTriggerService) {}

    @Get()
    list(@Playground() user: UserPlayground, @Query() query: QueryProgrammingTriggerDto) {
        return this.programmingTriggerService.findAll(user.id, query);
    }

    @Post()
    create(@Playground() user: UserPlayground, @Body() dto: CreateProgrammingTriggerDto) {
        return this.programmingTriggerService.create(user.id, dto);
    }

    @Get(":id")
    detail(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.programmingTriggerService.findDetail(id, user.id);
    }

    @Patch(":id")
    update(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: UpdateProgrammingTriggerDto,
    ) {
        return this.programmingTriggerService.update(id, user.id, dto);
    }

    @Delete(":id")
    async remove(@Playground() user: UserPlayground, @Param("id") id: string) {
        await this.programmingTriggerService.remove(id, user.id);
    }

    @Post(":id/execute")
    execute(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: ExecuteProgrammingTriggerDto,
        @Headers("x-installation-id") installationId?: string,
    ) {
        return this.programmingTriggerService.execute(id, user.id, dto, installationId);
    }
}
