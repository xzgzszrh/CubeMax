import { type ClassroomCaller, ClassroomKitService } from "@buildingai/core/modules/classroom";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Get, Headers, Param, Post, Query } from "@nestjs/common";

import {
    AppendClassroomPromptDto,
    ApplyClassroomConfigDto,
    ApplyClassroomPromptDto,
    StartClassroomSessionDto,
} from "../dto/classroom-kit.dto";

/**
 * 课堂能力的 HTTP 轨，给应用**前端**用。
 *
 * 应用跑在 iframe 里，很多交互（老师面板选设备、白板刷新排行榜）在前端直接
 * 发起最省事，不必绕一圈自己的后端。这里和 SDK 轨调的是同一个
 * `ClassroomKitService`，权限断言只有一份，不存在两套授权逻辑。
 *
 * 有一件事这条轨做不到：注册 MCP 工具。工具的 handler 是函数，没法经 JSON
 * 传过来，必须由应用后端通过 SDK 注册。所以带工具的活动请在应用后端
 * `startSession`，前端只负责读数据、下发提示词和结束会话。
 *
 * 路径里的 `:extension` 是会话的归属标识。它由前端传入、可被伪造，因此只用于
 * 会话命名空间与排障 —— 所有真正的操作都按调用者在该班级的权限判定，
 * 冒用别的应用标识不会让任何人多拿到一点权限。
 */
@WebController("classroom-kit")
export class ClassroomKitController {
    constructor(private readonly classroomKit: ClassroomKitService) {}

    private caller(
        user: UserPlayground,
        extensionIdentifier: string,
        organizationId?: string,
    ): ClassroomCaller {
        return {
            userId: user.id,
            organizationId: organizationId || null,
            extensionIdentifier,
        };
    }

    // ==================== 课堂与成员 ====================

    @Get(":extension/classroom")
    getClassroom(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.getClassroom(this.caller(user, extension, organizationId));
    }

    @Get(":extension/members")
    listMembers(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.listMembers(this.caller(user, extension, organizationId));
    }

    // ==================== 设备 ====================

    @Get(":extension/devices")
    listDevices(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Headers("x-organization-id") organizationId?: string,
        @Query("assignedUserId") assignedUserId?: string,
    ) {
        return this.classroomKit.listDevices(
            this.caller(user, extension, organizationId),
            assignedUserId === undefined ? {} : { assignedUserId: assignedUserId || null },
        );
    }

    @Get(":extension/devices/:agentBindingId")
    getDevice(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Param("agentBindingId", UUIDValidationPipe) agentBindingId: string,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.getDevice(
            this.caller(user, extension, organizationId),
            agentBindingId,
        );
    }

    @Get(":extension/devices/:agentBindingId/config")
    readDeviceConfig(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Param("agentBindingId", UUIDValidationPipe) agentBindingId: string,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.readDeviceConfig(
            this.caller(user, extension, organizationId),
            agentBindingId,
        );
    }

    @Post(":extension/devices/config")
    applyConfig(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Body() dto: ApplyClassroomConfigDto,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.applyDeviceConfig(
            this.caller(user, extension, organizationId),
            dto.targets,
        );
    }

    @Post(":extension/devices/prompt")
    applyPrompt(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Body() dto: ApplyClassroomPromptDto,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.applyPrompt(
            this.caller(user, extension, organizationId),
            dto.prompts,
        );
    }

    @Post(":extension/devices/prompt/append")
    appendPrompt(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Body() dto: AppendClassroomPromptDto,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.appendPrompt(
            this.caller(user, extension, organizationId),
            dto.agentBindingIds,
            dto.snippet,
            dto.separator,
        );
    }

    // ==================== 会话 ====================

    @Get(":extension/sessions")
    listSessions(@Param("extension") extension: string) {
        return this.classroomKit.listActiveSessions(extension);
    }

    @Get(":extension/sessions/:sessionKey")
    getSession(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Param("sessionKey") sessionKey: string,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.getSession(
            this.caller(user, extension, organizationId),
            sessionKey,
        );
    }

    @Post(":extension/sessions")
    startSession(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Body() dto: StartClassroomSessionDto,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.startSession(this.caller(user, extension, organizationId), dto);
    }

    @Post(":extension/sessions/:sessionKey/end")
    endSession(
        @Playground() user: UserPlayground,
        @Param("extension") extension: string,
        @Param("sessionKey") sessionKey: string,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomKit.endSession(
            this.caller(user, extension, organizationId),
            sessionKey,
        );
    }
}
