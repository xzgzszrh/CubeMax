import { Module } from "@nestjs/common";

import { HttpUpgradeRouter } from "./http-upgrade-router";

@Module({
    providers: [HttpUpgradeRouter],
    exports: [HttpUpgradeRouter],
})
export class WsUpgradeModule {}
