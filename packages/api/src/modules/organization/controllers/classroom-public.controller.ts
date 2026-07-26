import { WebController } from "@common/decorators/controller.decorator";
import { Get, Header, Param } from "@nestjs/common";

import { ClassroomService } from "../services/classroom.service";

/**
 * 公开课堂大屏接口，单独一个控制器以便整体跳过登录认证。
 * 只读展示数据（活动名、大屏配置、完成事件），不暴露任何工作空间内部信息。
 */
@WebController({ path: "classroom-display", skipAuth: true })
export class ClassroomPublicController {
    constructor(private readonly classroomService: ClassroomService) {}

    @Get(":publicId")
    @Header("Cache-Control", "no-store")
    getDisplay(@Param("publicId") publicId: string) {
        return this.classroomService.getPublicDisplay(String(publicId || ""));
    }
}
