import { type UserPlayground } from "@buildingai/db";
import { AssignmentStatus } from "@buildingai/db/entities";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { HttpErrorFactory } from "@buildingai/errors";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { WebController } from "@common/decorators/controller.decorator";
import {
    Body,
    Delete,
    Get,
    Headers,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Put,
    Query,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { SaveAppGrantsDto, UpdateAppWhitelistDto } from "../dto/app-grant.dto";
import { ReviewSubmissionDto, SaveAssignmentDto, SubmitAssignmentDto } from "../dto/assignment.dto";
import {
    ClassroomEventsQueryDto,
    ClassroomTestEventDto,
    SaveClassroomInteractionDto,
} from "../dto/classroom.dto";
import {
    AddOrganizationMemberDto,
    ApplyXiaozhiSceneDto,
    AssignXiaozhiAgentDto,
    BatchCreateManagedAccountsDto,
    BindXiaozhiAccountDto,
    BindXiaozhiDeviceDto,
    ChatHistoryQueryDto,
    CreateOrganizationDto,
    LinkBuildingAgentDto,
    OrganizationSearchDto,
    ReconnectXiaozhiAccountDto,
    RenameXiaozhiAgentDto,
    SaveXiaozhiQuickCommandDto,
    SaveXiaozhiSceneDto,
    UpdateConfigLocksDto,
    UpdateDeviceAliasDto,
    UpdateDeviceAutoUpdateDto,
    UpdateOrganizationMemberDto,
    UpdateXiaozhiAccountDto,
    UpdateXiaozhiAgentConfigDto,
} from "../dto/organization.dto";
import { AllocateQuotaDto } from "../dto/quota.dto";
import {
    BatchConfigureXiaozhiMcpDto,
    ReportXiaozhiMcpCompletionDto,
    UpdateXiaozhiMcpConnectionDto,
    UpdateXiaozhiMcpSettingsDto,
} from "../dto/xiaozhi-mcp.dto";
import { AssignmentService } from "../services/assignment.service";
import { ClassroomService } from "../services/classroom.service";
import { OrganizationService } from "../services/organization.service";
import { OrganizationAppService } from "../services/organization-app.service";
import { OrganizationQuotaService } from "../services/organization-quota.service";
import { XiaozhiService } from "../services/xiaozhi.service";
import { XiaozhiAutomationService } from "../services/xiaozhi-automation.service";
import { XiaozhiMcpService } from "../services/xiaozhi-mcp.service";

@WebController("organizations")
export class OrganizationController {
    constructor(
        private readonly organizationService: OrganizationService,
        private readonly xiaozhiService: XiaozhiService,
        private readonly automationService: XiaozhiAutomationService,
        private readonly mcpService: XiaozhiMcpService,
        private readonly classroomService: ClassroomService,
        private readonly assignmentService: AssignmentService,
        private readonly appService: OrganizationAppService,
        private readonly quotaService: OrganizationQuotaService,
    ) {}

    /**
     * 讲台功能都以班级为单位，个人空间下没有意义，这里统一挡掉。
     */
    private requireOrganization(organizationId?: string): string {
        if (!organizationId) {
            throw HttpErrorFactory.badRequest("请先切换到班级工作空间后再操作");
        }
        return organizationId;
    }

    @Get("context")
    getContext(@Playground() user: UserPlayground) {
        return this.organizationService.getContext(user.id);
    }

    @Post()
    create(@Playground() user: UserPlayground, @Body() dto: CreateOrganizationDto) {
        return this.organizationService.create(user.id, dto);
    }

    @Get(":organizationId/members")
    listMembers(
        @Playground() user: UserPlayground,
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @Query() query: OrganizationSearchDto,
    ) {
        return this.organizationService.listMembers(user.id, organizationId, query.keyword);
    }

    @Get(":organizationId/search-users")
    searchUsers(
        @Playground() user: UserPlayground,
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @Query() query: OrganizationSearchDto,
    ) {
        return this.organizationService.searchPersonalUsers(user.id, organizationId, query.keyword);
    }

    @Post(":organizationId/members")
    addMember(
        @Playground() user: UserPlayground,
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @Body() dto: AddOrganizationMemberDto,
    ) {
        return this.organizationService.addMember(user.id, organizationId, dto);
    }

    @Patch(":organizationId/members/:memberId")
    updateMember(
        @Playground() user: UserPlayground,
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @Param("memberId", UUIDValidationPipe) memberId: string,
        @Body() dto: UpdateOrganizationMemberDto,
    ) {
        return this.organizationService.updateMemberRoles(
            user.id,
            organizationId,
            memberId,
            dto.roles,
        );
    }

    @Post(":organizationId/leave")
    leave(
        @Playground() user: UserPlayground,
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
    ) {
        return this.organizationService.leave(user.id, organizationId);
    }

    @Post(":organizationId/subaccounts")
    createSubaccounts(
        @Playground() user: UserPlayground,
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @Body() dto: BatchCreateManagedAccountsDto,
    ) {
        return this.organizationService.createManagedAccounts(
            user.id,
            organizationId,
            dto.accounts,
        );
    }

    @Post(":organizationId/subaccounts/import")
    @UseInterceptors(
        FileInterceptor("file", {
            limits: { fileSize: 2 * 1024 * 1024 },
        }),
    )
    importSubaccounts(
        @Playground() user: UserPlayground,
        @Param("organizationId", UUIDValidationPipe) organizationId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.organizationService.importManagedAccounts(user.id, organizationId, file);
    }

    @Get("xiaozhi/captcha")
    getXiaozhiCaptcha(@Playground() user: UserPlayground) {
        return this.xiaozhiService.getCaptcha(user.id);
    }

    @Get("xiaozhi/accounts")
    getXiaozhiAccounts(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.xiaozhiService.listAccounts(user.id, organizationId);
    }

    @Post("xiaozhi/accounts")
    bindXiaozhiAccount(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: BindXiaozhiAccountDto,
    ) {
        return this.xiaozhiService.bindAccount(user.id, organizationId, dto);
    }

    @Post("xiaozhi/accounts/:accountId/sync")
    syncXiaozhiAccount(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("accountId", UUIDValidationPipe) accountId: string,
    ) {
        return this.xiaozhiService.syncAccount(user.id, organizationId, accountId);
    }

    @Post("xiaozhi/accounts/:accountId/reconnect")
    reconnectXiaozhiAccount(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("accountId", UUIDValidationPipe) accountId: string,
        @Body() dto: ReconnectXiaozhiAccountDto,
    ) {
        return this.xiaozhiService.reconnectAccount(user.id, organizationId, accountId, dto);
    }

    @Patch("xiaozhi/accounts/:accountId")
    updateXiaozhiAccount(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("accountId", UUIDValidationPipe) accountId: string,
        @Body() dto: UpdateXiaozhiAccountDto,
    ) {
        return this.xiaozhiService.updateAccountLabel(
            user.id,
            organizationId,
            accountId,
            dto.label,
        );
    }

    @Delete("xiaozhi/accounts/:accountId")
    removeXiaozhiAccount(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("accountId", UUIDValidationPipe) accountId: string,
    ) {
        return this.xiaozhiService.removeAccount(user.id, organizationId, accountId);
    }

    @Get("xiaozhi/agents")
    getXiaozhiAgents(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.xiaozhiService.listAgents(user.id, organizationId);
    }

    @Patch("xiaozhi/agents/:agentId/assignment")
    assignXiaozhiAgent(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Body() dto: AssignXiaozhiAgentDto,
    ) {
        return this.xiaozhiService.assignAgent(
            user.id,
            organizationId,
            agentId,
            dto.assignedUserId,
        );
    }

    @Patch("xiaozhi/agents/:agentId/config-locks")
    updateXiaozhiConfigLocks(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Body() dto: UpdateConfigLocksDto,
    ) {
        return this.xiaozhiService.updateConfigLocks(user.id, organizationId, agentId, dto.keys);
    }

    @Patch("xiaozhi/agents/:agentId/building-agent")
    linkBuildingAgent(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Body() dto: LinkBuildingAgentDto,
    ) {
        return this.xiaozhiService.linkBuildingAgent(
            user.id,
            organizationId,
            agentId,
            dto.agentId || null,
        );
    }

    @Post("xiaozhi/agents/:agentId/building-agent/sync")
    syncLinkedBuildingAgent(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
    ) {
        return this.xiaozhiService.syncLinkedBuildingAgent(user.id, organizationId, agentId);
    }

    @Delete("xiaozhi/agents/:agentId")
    deleteXiaozhiAgent(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
    ) {
        return this.xiaozhiService.deleteAgent(user.id, organizationId, agentId);
    }

    @Get("xiaozhi/agents/:agentId/editor")
    getXiaozhiAgentEditor(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
    ) {
        return this.xiaozhiService.getAgentEditorData(user.id, organizationId, agentId);
    }

    @Patch("xiaozhi/agents/:agentId/name")
    renameXiaozhiAgent(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Body() dto: RenameXiaozhiAgentDto,
    ) {
        return this.xiaozhiService.renameAgent(user.id, organizationId, agentId, dto.name);
    }

    @Patch("xiaozhi/agents/:agentId/config")
    updateXiaozhiAgentConfig(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Body() dto: UpdateXiaozhiAgentConfigDto,
    ) {
        return this.xiaozhiService.updateAgentConfig(user.id, organizationId, agentId, dto.config);
    }

    @Get("xiaozhi/agents/:agentId/devices")
    getXiaozhiDevices(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
    ) {
        return this.xiaozhiService.listDevices(user.id, organizationId, agentId);
    }

    @Post("xiaozhi/agents/:agentId/devices")
    bindXiaozhiDevice(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Body() dto: BindXiaozhiDeviceDto,
    ) {
        return this.xiaozhiService.bindDevice(
            user.id,
            organizationId,
            agentId,
            dto.verificationCode,
        );
    }

    @Patch("xiaozhi/agents/:agentId/devices/:deviceId/alias")
    updateXiaozhiDeviceAlias(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Body() dto: UpdateDeviceAliasDto,
    ) {
        return this.xiaozhiService.updateDeviceAlias(user.id, organizationId, agentId, dto);
    }

    @Patch("xiaozhi/agents/:agentId/devices/:deviceId/auto-update")
    updateXiaozhiDeviceAutoUpdate(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Body() dto: UpdateDeviceAutoUpdateDto,
    ) {
        return this.xiaozhiService.updateDeviceAutoUpdate(user.id, organizationId, agentId, dto);
    }

    @Delete("xiaozhi/agents/:agentId/devices/:deviceId")
    unbindXiaozhiDevice(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Param("deviceId", ParseIntPipe) deviceId: number,
    ) {
        return this.xiaozhiService.unbindDevice(user.id, organizationId, agentId, deviceId);
    }

    @Get("xiaozhi/scenes")
    listXiaozhiScenes(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.automationService.listScenes(user.id, organizationId);
    }

    @Post("xiaozhi/scenes")
    createXiaozhiScene(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: SaveXiaozhiSceneDto,
    ) {
        return this.automationService.createScene(user.id, organizationId, dto);
    }

    @Patch("xiaozhi/scenes/:sceneId")
    updateXiaozhiScene(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("sceneId", UUIDValidationPipe) sceneId: string,
        @Body() dto: SaveXiaozhiSceneDto,
    ) {
        return this.automationService.updateScene(user.id, organizationId, sceneId, dto);
    }

    @Delete("xiaozhi/scenes/:sceneId")
    removeXiaozhiScene(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("sceneId", UUIDValidationPipe) sceneId: string,
    ) {
        return this.automationService.removeScene(user.id, organizationId, sceneId);
    }

    @Post("xiaozhi/scenes/:sceneId/apply")
    applyXiaozhiScene(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("sceneId", UUIDValidationPipe) sceneId: string,
        @Body() dto: ApplyXiaozhiSceneDto,
    ) {
        return this.automationService.applySceneToAgents(
            user.id,
            organizationId,
            sceneId,
            dto.agentIds,
        );
    }

    @Get("xiaozhi/quick-commands")
    listXiaozhiQuickCommands(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.automationService.listCommands(user.id, organizationId);
    }

    @Post("xiaozhi/quick-commands")
    createXiaozhiQuickCommand(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: SaveXiaozhiQuickCommandDto,
    ) {
        return this.automationService.createCommand(user.id, organizationId, dto);
    }

    @Patch("xiaozhi/quick-commands/:commandId")
    updateXiaozhiQuickCommand(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("commandId", UUIDValidationPipe) commandId: string,
        @Body() dto: SaveXiaozhiQuickCommandDto,
    ) {
        return this.automationService.updateCommand(user.id, organizationId, commandId, dto);
    }

    @Delete("xiaozhi/quick-commands/:commandId")
    removeXiaozhiQuickCommand(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("commandId", UUIDValidationPipe) commandId: string,
    ) {
        return this.automationService.removeCommand(user.id, organizationId, commandId);
    }

    @Post("xiaozhi/quick-commands/:commandId/execute")
    executeXiaozhiQuickCommand(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("commandId", UUIDValidationPipe) commandId: string,
    ) {
        return this.automationService.executeCommand(user.id, organizationId, commandId);
    }

    @Get("xiaozhi/agents/:agentId/chats")
    getXiaozhiAgentChats(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Query() query: ChatHistoryQueryDto,
    ) {
        return this.xiaozhiService.listAgentChats(user.id, organizationId, agentId, query.pageSize);
    }

    @Get("xiaozhi/agents/:agentId/chats/:chatId/messages")
    getXiaozhiChatMessages(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("agentId", UUIDValidationPipe) agentId: string,
        @Param("chatId", ParseIntPipe) chatId: number,
    ) {
        return this.xiaozhiService.listChatMessages(user.id, organizationId, agentId, chatId);
    }

    @Get("xiaozhi/mcp/connections")
    listXiaozhiMcpConnections(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.mcpService.listConnections(user.id, organizationId);
    }

    @Get("xiaozhi/mcp/settings")
    getXiaozhiMcpSettings(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.mcpService.getSettings(user.id, organizationId);
    }

    @Patch("xiaozhi/mcp/settings")
    updateXiaozhiMcpSettings(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: UpdateXiaozhiMcpSettingsDto,
    ) {
        return this.mcpService.updateSettings(user.id, organizationId, dto);
    }

    @Post("xiaozhi/mcp/batch-configure")
    batchConfigureXiaozhiMcp(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: BatchConfigureXiaozhiMcpDto,
    ) {
        return this.mcpService.batchConfigure(user.id, organizationId, dto);
    }

    @Post("xiaozhi/mcp/connections/:connectionId/reconnect")
    reconnectXiaozhiMcp(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("connectionId", UUIDValidationPipe) connectionId: string,
    ) {
        return this.mcpService.reconnectConnection(user.id, organizationId, connectionId);
    }

    @Patch("xiaozhi/mcp/connections/:connectionId")
    updateXiaozhiMcpConnection(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("connectionId", UUIDValidationPipe) connectionId: string,
        @Body() dto: UpdateXiaozhiMcpConnectionDto,
    ) {
        return this.mcpService.setConnectionEnabled(
            user.id,
            organizationId,
            connectionId,
            dto.enabled,
        );
    }

    @Delete("xiaozhi/mcp/connections/:connectionId")
    removeXiaozhiMcpConnection(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("connectionId", UUIDValidationPipe) connectionId: string,
    ) {
        return this.mcpService.removeConnection(user.id, organizationId, connectionId);
    }

    @Post("xiaozhi/mcp/connections/:connectionId/report")
    reportXiaozhiMcpCompletion(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("connectionId", UUIDValidationPipe) connectionId: string,
        @Body() dto: ReportXiaozhiMcpCompletionDto,
    ) {
        return this.mcpService.reportManualCompletion(user.id, organizationId, connectionId, dto);
    }

    @Get("classroom/interactions")
    listClassroomInteractions(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.classroomService.listInteractions(user.id, organizationId);
    }

    @Post("classroom/interactions")
    createClassroomInteraction(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: SaveClassroomInteractionDto,
    ) {
        return this.classroomService.createInteraction(user.id, organizationId, dto);
    }

    @Patch("classroom/interactions/:interactionId")
    updateClassroomInteraction(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("interactionId", UUIDValidationPipe) interactionId: string,
        @Body() dto: SaveClassroomInteractionDto,
    ) {
        return this.classroomService.updateInteraction(user.id, organizationId, interactionId, dto);
    }

    @Delete("classroom/interactions/:interactionId")
    removeClassroomInteraction(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("interactionId", UUIDValidationPipe) interactionId: string,
    ) {
        return this.classroomService.removeInteraction(user.id, organizationId, interactionId);
    }

    @Post("classroom/interactions/:interactionId/start")
    startClassroomInteraction(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("interactionId", UUIDValidationPipe) interactionId: string,
    ) {
        return this.classroomService.startInteraction(user.id, organizationId, interactionId);
    }

    @Post("classroom/interactions/:interactionId/end")
    endClassroomInteraction(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("interactionId", UUIDValidationPipe) interactionId: string,
    ) {
        return this.classroomService.endInteraction(user.id, organizationId, interactionId);
    }

    @Get("classroom/interactions/:interactionId/events")
    listClassroomEvents(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("interactionId", UUIDValidationPipe) interactionId: string,
        @Query() query: ClassroomEventsQueryDto,
    ) {
        return this.classroomService.listEvents(
            user.id,
            organizationId,
            interactionId,
            query.limit,
        );
    }

    @Post("classroom/events/test")
    createClassroomTestEvent(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: ClassroomTestEventDto,
    ) {
        return this.classroomService.createTestEvent(user.id, organizationId, dto);
    }

    // ==================== 班级任务列表 ====================

    @Get("assignments")
    listAssignments(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.assignmentService.list(user.id, this.requireOrganization(organizationId));
    }

    @Post("assignments")
    createAssignment(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: SaveAssignmentDto,
    ) {
        return this.assignmentService.save(user.id, this.requireOrganization(organizationId), dto);
    }

    @Patch("assignments/:assignmentId")
    updateAssignment(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("assignmentId", UUIDValidationPipe) assignmentId: string,
        @Body() dto: SaveAssignmentDto,
    ) {
        return this.assignmentService.save(
            user.id,
            this.requireOrganization(organizationId),
            dto,
            assignmentId,
        );
    }

    @Delete("assignments/:assignmentId")
    removeAssignment(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("assignmentId", UUIDValidationPipe) assignmentId: string,
    ) {
        return this.assignmentService.remove(
            user.id,
            this.requireOrganization(organizationId),
            assignmentId,
        );
    }

    @Post("assignments/:assignmentId/publish")
    publishAssignment(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("assignmentId", UUIDValidationPipe) assignmentId: string,
    ) {
        return this.assignmentService.updateStatus(
            user.id,
            this.requireOrganization(organizationId),
            assignmentId,
            AssignmentStatus.PUBLISHED,
        );
    }

    @Post("assignments/:assignmentId/close")
    closeAssignment(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("assignmentId", UUIDValidationPipe) assignmentId: string,
    ) {
        return this.assignmentService.updateStatus(
            user.id,
            this.requireOrganization(organizationId),
            assignmentId,
            AssignmentStatus.CLOSED,
        );
    }

    @Get("assignments/:assignmentId/submissions")
    listAssignmentSubmissions(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("assignmentId", UUIDValidationPipe) assignmentId: string,
    ) {
        return this.assignmentService.listSubmissions(
            user.id,
            this.requireOrganization(organizationId),
            assignmentId,
        );
    }

    @Patch("submissions/:submissionId/review")
    reviewSubmission(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("submissionId", UUIDValidationPipe) submissionId: string,
        @Body() dto: ReviewSubmissionDto,
    ) {
        return this.assignmentService.review(
            user.id,
            this.requireOrganization(organizationId),
            submissionId,
            dto,
        );
    }

    @Get("my-assignments")
    listMyAssignments(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.assignmentService.listMine(user.id, this.requireOrganization(organizationId));
    }

    @Post("my-assignments/:assignmentId/submit")
    submitAssignment(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Param("assignmentId", UUIDValidationPipe) assignmentId: string,
        @Body() dto: SubmitAssignmentDto,
    ) {
        return this.assignmentService.submit(
            user.id,
            this.requireOrganization(organizationId),
            assignmentId,
            dto,
        );
    }

    // ==================== 班级应用管理 ====================

    @Get("app-grants")
    getAppGrants(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.appService.getGrantMatrix(user.id, this.requireOrganization(organizationId));
    }

    @Put("app-grants")
    saveAppGrants(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: SaveAppGrantsDto,
    ) {
        return this.appService.saveGrants(user.id, this.requireOrganization(organizationId), dto);
    }

    @Patch("app-whitelist")
    updateAppWhitelist(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: UpdateAppWhitelistDto,
    ) {
        return this.appService.updateWhitelist(
            user.id,
            this.requireOrganization(organizationId),
            dto,
        );
    }

    @Get("my-apps")
    listMyApps(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.appService.listMine(user.id, this.requireOrganization(organizationId));
    }

    // ==================== 额度管理 ====================

    @Get("quota")
    getQuota(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.quotaService.getOverview(user.id, this.requireOrganization(organizationId));
    }

    @Get("quota/logs")
    listQuotaLogs(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId?: string,
    ) {
        return this.quotaService.listLogs(user.id, this.requireOrganization(organizationId));
    }

    @Post("quota/allocate")
    allocateQuota(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: AllocateQuotaDto,
    ) {
        return this.quotaService.allocate(user.id, this.requireOrganization(organizationId), dto);
    }

    @Post("quota/reclaim")
    reclaimQuota(
        @Playground() user: UserPlayground,
        @Headers("x-organization-id") organizationId: string | undefined,
        @Body() dto: AllocateQuotaDto,
    ) {
        return this.quotaService.reclaim(user.id, this.requireOrganization(organizationId), dto);
    }
}
