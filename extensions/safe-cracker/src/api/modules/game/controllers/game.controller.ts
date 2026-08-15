import { BaseController } from "@buildingai/base";
import { ExtensionWebController } from "@buildingai/core/decorators";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { HttpErrorFactory } from "@buildingai/errors";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { Body, Get, Headers, Param, Post } from "@nestjs/common";

import { AttemptDto, StartGameDto } from "../dto";
import { GameService } from "../services/game.service";

/**
 * 破解保险箱的对外接口，挂在 `/safe-cracker/api/game` 下。
 *
 * 权限一律由 GameService 借 ClassroomKit 断言，这里只负责取出调用者与班级。
 */
@ExtensionWebController("game")
export class GameController extends BaseController {
    constructor(private readonly gameService: GameService) {
        super();
    }

    /** 游戏以班级为单位，个人空间下没有学生也没有大屏，直接挡掉。 */
    private requireOrganization(organizationId?: string): string {
        if (!organizationId) {
            throw HttpErrorFactory.badRequest("请先切换到班级工作空间再玩破解保险箱");
        }
        return organizationId;
    }

    // ==================== 老师侧 ====================

    @Get("devices")
    listDevices(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.gameService.listDevices(user.id, this.requireOrganization(organizationId));
    }

    @Get("current")
    getCurrent(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.gameService.getCurrent(user.id, this.requireOrganization(organizationId));
    }

    @Post()
    startGame(
        @Playground() user: UserPlayground,
        @Body() dto: StartGameDto,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.gameService.startGame(user.id, this.requireOrganization(organizationId), dto);
    }

    @Post(":id/end")
    endGame(
        @Playground() user: UserPlayground,
        @Param("id", UUIDValidationPipe) id: string,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.gameService.endGame(user.id, this.requireOrganization(organizationId), id);
    }

    // ==================== 学生侧 ====================

    @Get("mine")
    getMine(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.gameService.getStudentView(user.id, this.requireOrganization(organizationId));
    }

    @Post("mine/attempt")
    attempt(
        @Playground() user: UserPlayground,
        @Body() dto: AttemptDto,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.gameService.submitStudentAttempt(
            user.id,
            this.requireOrganization(organizationId),
            dto.password,
        );
    }

    // ==================== 大屏侧 ====================

    @Get("board")
    getBoard(@Headers("x-organization-id") organizationId?: string) {
        return this.gameService.getBoard(this.requireOrganization(organizationId));
    }
}
