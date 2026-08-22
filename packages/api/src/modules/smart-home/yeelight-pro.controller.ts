import type { UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";

import {
    QueryYeelightProDevicesDto,
    SelectYeelightProHouseDto,
    StartYeelightProQrDto,
    UpdateYeelightProAccountDto,
    YeelightProLightCommandDto,
    YeelightProPropertyCommandDto,
} from "./yeelight-pro.dto";
import { YeelightProService } from "./yeelight-pro.service";

@WebController("smart-home")
export class YeelightProController {
    constructor(private readonly yeelightProService: YeelightProService) {}

    @Get("yeelight/accounts")
    listAccounts(@Playground() user: UserPlayground) {
        return this.yeelightProService.listAccounts(user.id);
    }

    @Post("yeelight/qr/start")
    startQrLogin(@Playground() user: UserPlayground, @Body() dto: StartYeelightProQrDto) {
        return this.yeelightProService.startQrLogin(user.id, dto.region);
    }

    @Get("yeelight/qr/:sessionId")
    pollQrLogin(
        @Playground() user: UserPlayground,
        @Param("sessionId", UUIDValidationPipe) sessionId: string,
    ) {
        return this.yeelightProService.pollQrLogin(user.id, sessionId);
    }

    @Post("yeelight/accounts/:accountId/house")
    selectHouse(
        @Playground() user: UserPlayground,
        @Param("accountId", UUIDValidationPipe) accountId: string,
        @Body() dto: SelectYeelightProHouseDto,
    ) {
        return this.yeelightProService.selectHouse(user.id, accountId, dto.houseId);
    }

    @Post("yeelight/accounts/:accountId/sync")
    syncAccount(
        @Playground() user: UserPlayground,
        @Param("accountId", UUIDValidationPipe) accountId: string,
    ) {
        return this.yeelightProService.syncAccount(user.id, accountId);
    }

    @Patch("yeelight/accounts/:accountId")
    updateAccount(
        @Playground() user: UserPlayground,
        @Param("accountId", UUIDValidationPipe) accountId: string,
        @Body() dto: UpdateYeelightProAccountDto,
    ) {
        return this.yeelightProService.updateAccountLabel(user.id, accountId, dto.label);
    }

    @Delete("yeelight/accounts/:accountId")
    async removeAccount(
        @Playground() user: UserPlayground,
        @Param("accountId", UUIDValidationPipe) accountId: string,
    ) {
        await this.yeelightProService.removeAccount(user.id, accountId);
    }

    @Get("yeelight/devices")
    listDevices(@Playground() user: UserPlayground, @Query() filters: QueryYeelightProDevicesDto) {
        return this.yeelightProService.listDevices(user.id, filters);
    }

    @Get("yeelight/devices/:deviceId")
    getDevice(
        @Playground() user: UserPlayground,
        @Param("deviceId", UUIDValidationPipe) deviceId: string,
    ) {
        return this.yeelightProService.getDevice(user.id, deviceId);
    }

    @Post("yeelight/devices/:deviceId/refresh")
    refreshDevice(
        @Playground() user: UserPlayground,
        @Param("deviceId", UUIDValidationPipe) deviceId: string,
    ) {
        return this.yeelightProService.refreshDevice(user.id, deviceId);
    }

    @Post("yeelight/devices/:deviceId/properties")
    setProperty(
        @Playground() user: UserPlayground,
        @Param("deviceId", UUIDValidationPipe) deviceId: string,
        @Body() command: YeelightProPropertyCommandDto,
    ) {
        return this.yeelightProService.setProperty(user.id, deviceId, command);
    }

    @Post("yeelight/devices/:deviceId/light")
    setLight(
        @Playground() user: UserPlayground,
        @Param("deviceId", UUIDValidationPipe) deviceId: string,
        @Body() command: YeelightProLightCommandDto,
    ) {
        return this.yeelightProService.setProperties(
            user.id,
            deviceId,
            command.properties || {},
            command.duration,
        );
    }
}
