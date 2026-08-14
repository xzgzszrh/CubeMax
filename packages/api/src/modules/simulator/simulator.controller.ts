import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Param, Patch, Post } from "@nestjs/common";

import {
    ApplySimulatorOperationsDto,
    CreateSimulatorSessionDto,
    UpdateSimulatorBoardDto,
    UpdateSimulatorInputDto,
    WriteSimulatorSerialDto,
} from "./simulator.dto";
import { SimulatorService } from "./simulator.service";

@WebController("simulator")
export class SimulatorController {
    constructor(private readonly simulatorService: SimulatorService) {}

    @Get("sessions")
    list(@Playground() user: UserPlayground) {
        return this.simulatorService.list(user.id);
    }

    @Post("sessions")
    create(@Playground() user: UserPlayground, @Body() dto: CreateSimulatorSessionDto) {
        return this.simulatorService.create(user.id, dto.name, dto.boardType);
    }

    @Get("sessions/:id")
    get(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.simulatorService.getForUser(id, user.id);
    }

    @Post("sessions/:id/reset")
    reset(@Playground() user: UserPlayground, @Param("id") id: string) {
        return this.simulatorService.reset(id, user.id);
    }

    @Patch("sessions/:id/board")
    updateBoard(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: UpdateSimulatorBoardDto,
    ) {
        return this.simulatorService.updateBoard(id, user.id, dto.boardType);
    }

    @Patch("sessions/:id/input")
    updateInput(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: UpdateSimulatorInputDto,
    ) {
        return this.simulatorService.updateInput(id, user.id, dto);
    }

    @Post("sessions/:id/serial")
    serial(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: WriteSimulatorSerialDto,
    ) {
        return this.simulatorService.writeSerialInput(id, user.id, dto.text);
    }

    @Post("sessions/:id/operations")
    applyOperations(
        @Playground() user: UserPlayground,
        @Param("id") id: string,
        @Body() dto: ApplySimulatorOperationsDto,
    ) {
        return this.simulatorService.applyOperationsForUser(id, user.id, dto.operations);
    }

    @Delete("sessions/:id")
    remove(@Playground() user: UserPlayground, @Param("id") id: string) {
        this.simulatorService.remove(id, user.id);
    }
}
