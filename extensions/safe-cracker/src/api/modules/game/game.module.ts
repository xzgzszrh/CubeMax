import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Module } from "@nestjs/common";

import { SafeGameParticipant } from "../../db/entities/safe-game-participant.entity";
import { SafeGameSession } from "../../db/entities/safe-game-session.entity";
import { GameController } from "./controllers/game.controller";
import { GameService } from "./services/game.service";

/**
 * ClassroomKitModule 由宿主以 @Global() 提供，这里不能再 imports 一次 ——
 * 重复提供会造出第二个工具注册表，方糖猫网关就看不见我们注册的工具了。
 */
@Module({
    imports: [TypeOrmModule.forFeature([SafeGameSession, SafeGameParticipant])],
    controllers: [GameController],
    providers: [GameService],
    exports: [GameService],
})
export class GameModule {}
