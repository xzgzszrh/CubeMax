import { ConsoleController, Permissions } from "@common/decorators";
import { Get } from "@nestjs/common";

import { LuaDeviceGatewayService } from "./lua-device-gateway.service";

@ConsoleController("esp32-devices", "ESP32 设备管理")
export class LuaDeviceConsoleController {
    constructor(private readonly gateway: LuaDeviceGatewayService) {}

    @Get()
    @Permissions({
        code: "list",
        name: "查看 ESP32 设备",
        description: "查看已连接过的 ESP32 设备",
    })
    list() {
        return this.gateway.listAllDevices();
    }
}
