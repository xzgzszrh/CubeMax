import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";

import { CreateLuaDeviceRunDto, QueryLuaRunLogsDto, RegisterLuaDeviceDto } from "./lua-device.dto";
import { LuaDeviceGatewayService } from "./lua-device-gateway.service";

@WebController("devices")
export class LuaDeviceController {
    constructor(private readonly gateway: LuaDeviceGatewayService) {}

    @Get()
    list(@Playground() user: UserPlayground) {
        return this.gateway.listDevices(user.id);
    }

    @Post()
    register(
        @Playground() user: UserPlayground,
        @Body() dto: RegisterLuaDeviceDto,
        @Req() request: Request,
    ) {
        const configuredUrl = process.env.LUA_DEVICE_GATEWAY_PUBLIC_URL;
        const publicUrl =
            configuredUrl ||
            `${request.protocol === "https" ? "wss" : "ws"}://${request.get("host")}${this.gateway.websocketPath}`;
        return this.gateway.registerDevice(user.id, dto, publicUrl);
    }

    @Get(":deviceId/lua-runs")
    listRuns(@Playground() user: UserPlayground, @Param("deviceId") deviceId: string) {
        return this.gateway.listRuns(user.id, deviceId);
    }

    @Post(":deviceId/lua-runs")
    createRun(
        @Playground() user: UserPlayground,
        @Param("deviceId") deviceId: string,
        @Body() dto: CreateLuaDeviceRunDto,
    ) {
        return this.gateway.createRun(user.id, deviceId, dto);
    }

    @Get(":deviceId/lua-runs/:runId")
    getRun(
        @Playground() user: UserPlayground,
        @Param("deviceId") deviceId: string,
        @Param("runId") runId: string,
    ) {
        return this.gateway.getRun(user.id, deviceId, runId);
    }

    @Get(":deviceId/lua-runs/:runId/logs")
    getLogs(
        @Playground() user: UserPlayground,
        @Param("deviceId") deviceId: string,
        @Param("runId") runId: string,
        @Query() query: QueryLuaRunLogsDto,
    ) {
        return this.gateway.getRunLogs(user.id, deviceId, runId, query.after ?? 0);
    }

    @Post(":deviceId/lua-runs/:runId/stop")
    stopRun(
        @Playground() user: UserPlayground,
        @Param("deviceId") deviceId: string,
        @Param("runId") runId: string,
    ) {
        return this.gateway.stopRun(user.id, deviceId, runId);
    }
}
