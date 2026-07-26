import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    ClassroomEvent,
    ClassroomInteraction,
    ClassroomInteractionStatus,
    type ClassroomInteractionTarget,
    XiaozhiAgentBinding,
    XiaozhiScene,
} from "@buildingai/db/entities";
import { In, IsNull, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { randomBytes } from "crypto";

import { OrganizationPermission } from "../constants/organization-permissions";
import type { ClassroomTestEventDto, SaveClassroomInteractionDto } from "../dto/classroom.dto";
import { OrganizationService } from "./organization.service";
import { XiaozhiAutomationService } from "./xiaozhi-automation.service";
import {
    XIAOZHI_MCP_TASK_COMPLETED_EVENT,
    type XiaozhiMcpTaskCompletedAck,
    type XiaozhiMcpTaskCompletedEvent,
} from "./xiaozhi-mcp.service";

/** 公开大屏单次返回的事件上限，与旧 console 保持一致。 */
const PUBLIC_EVENT_LIMIT = 500;

const PUBLIC_ID_PATTERN = /^[a-zA-Z0-9_-]{6,32}$/;

/** MCP 网关上报课堂完成事件时的载荷。 */
export type ClassroomEventInput = {
    taskKey?: string;
    summary: string;
    score?: number | null;
};

export type ClassroomEventResult = {
    accepted: boolean;
    event?: ClassroomEvent;
    interactionId?: string;
};

@Injectable()
export class ClassroomService {
    constructor(
        @InjectRepository(ClassroomInteraction)
        private readonly interactionRepository: Repository<ClassroomInteraction>,
        @InjectRepository(ClassroomEvent)
        private readonly eventRepository: Repository<ClassroomEvent>,
        @InjectRepository(XiaozhiScene)
        private readonly sceneRepository: Repository<XiaozhiScene>,
        @InjectRepository(XiaozhiAgentBinding)
        private readonly agentRepository: Repository<XiaozhiAgentBinding>,
        private readonly organizationService: OrganizationService,
        private readonly automationService: XiaozhiAutomationService,
    ) {}

    private async requireRead(userId: string, organizationId?: string | null) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            organizationId ? OrganizationPermission.ASSET_READ : undefined,
        );
    }

    private async requireManage(userId: string, organizationId?: string | null) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            organizationId ? OrganizationPermission.ASSET_MANAGE : undefined,
        );
    }

    private workspaceWhere(userId: string, organizationId?: string | null) {
        return organizationId
            ? { organizationId }
            : { organizationId: IsNull(), ownerUserId: userId };
    }

    /** Map agent binding ids to name-carrying targets, rejecting foreign agents. */
    private async resolveTargets(
        userId: string,
        organizationId: string | null | undefined,
        agentIds: string[],
    ): Promise<ClassroomInteractionTarget[]> {
        const agents = await this.agentRepository.find({
            where: { id: In(agentIds), ...this.workspaceWhere(userId, organizationId) },
        });
        const byId = new Map(agents.map((agent) => [agent.id, agent]));
        if (agentIds.some((id) => !byId.has(id))) {
            throw HttpErrorFactory.badRequest("部分目标智能体不存在或不属于当前工作空间");
        }
        return agentIds.map((id) => {
            const agent = byId.get(id) as XiaozhiAgentBinding;
            return { agentId: agent.id, agentName: agent.name };
        });
    }

    private async resolveScene(
        userId: string,
        organizationId: string | null | undefined,
        sceneId: string,
    ) {
        const scene = await this.sceneRepository.findOne({
            where: { id: sceneId, ...this.workspaceWhere(userId, organizationId) },
        });
        if (!scene) throw HttpErrorFactory.notFound("场景不存在");
        return scene;
    }

    private async resolveInteraction(
        userId: string,
        organizationId: string | null | undefined,
        interactionId: string,
    ) {
        const interaction = await this.interactionRepository.findOne({
            where: { id: interactionId, ...this.workspaceWhere(userId, organizationId) },
        });
        if (!interaction) throw HttpErrorFactory.notFound("课堂活动不存在");
        return interaction;
    }

    /** Public ids appear in shareable URLs; keep them short and check for reuse. */
    private async generatePublicId() {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const publicId = randomBytes(8).toString("hex");
            const existing = await this.interactionRepository.findOne({
                where: { publicId },
                withDeleted: true,
            });
            if (!existing) return publicId;
        }
        throw HttpErrorFactory.badRequest("生成大屏链接失败，请重试");
    }

    /** 附带场景名称快照返回，供列表直接展示。 */
    private async decorateWithSceneName(interactions: ClassroomInteraction[]) {
        const sceneIds = [...new Set(interactions.map((item) => item.sceneId))];
        const scenes = sceneIds.length
            ? await this.sceneRepository.find({ where: { id: In(sceneIds) }, withDeleted: true })
            : [];
        const nameById = new Map(scenes.map((scene) => [scene.id, scene.name]));
        return interactions.map((interaction) => ({
            ...interaction,
            sceneName: nameById.get(interaction.sceneId) || "已删除场景",
        }));
    }

    async listInteractions(userId: string, organizationId?: string | null) {
        await this.requireRead(userId, organizationId);
        const interactions = await this.interactionRepository.find({
            where: this.workspaceWhere(userId, organizationId),
            order: { updatedAt: "DESC" },
        });
        return this.decorateWithSceneName(interactions);
    }

    async createInteraction(
        userId: string,
        organizationId: string | null | undefined,
        dto: SaveClassroomInteractionDto,
    ) {
        await this.requireManage(userId, organizationId);
        const scene = await this.resolveScene(userId, organizationId, dto.sceneId);
        const targets = await this.resolveTargets(userId, organizationId, dto.agentIds);
        const interaction = await this.interactionRepository.save(
            this.interactionRepository.create({
                organizationId: organizationId || null,
                ownerUserId: userId,
                name: dto.name.trim(),
                description: dto.description?.trim() || "",
                sceneId: scene.id,
                targets,
                displayConfig: {
                    ...dto.displayConfig,
                    subtitle: dto.displayConfig.subtitle || "",
                },
                publicId: await this.generatePublicId(),
                status: ClassroomInteractionStatus.DRAFT,
                startedAt: null,
                endedAt: null,
            }),
        );
        const [decorated] = await this.decorateWithSceneName([interaction]);
        return decorated;
    }

    async updateInteraction(
        userId: string,
        organizationId: string | null | undefined,
        interactionId: string,
        dto: SaveClassroomInteractionDto,
    ) {
        await this.requireManage(userId, organizationId);
        const interaction = await this.resolveInteraction(userId, organizationId, interactionId);
        if (interaction.status === ClassroomInteractionStatus.ACTIVE) {
            throw HttpErrorFactory.conflict("进行中的课堂活动不能修改");
        }
        const scene = await this.resolveScene(userId, organizationId, dto.sceneId);
        interaction.name = dto.name.trim();
        interaction.description = dto.description?.trim() || "";
        interaction.sceneId = scene.id;
        interaction.targets = await this.resolveTargets(userId, organizationId, dto.agentIds);
        interaction.displayConfig = {
            ...dto.displayConfig,
            subtitle: dto.displayConfig.subtitle || "",
        };
        const saved = await this.interactionRepository.save(interaction);
        const [decorated] = await this.decorateWithSceneName([saved]);
        return decorated;
    }

    async removeInteraction(
        userId: string,
        organizationId: string | null | undefined,
        interactionId: string,
    ) {
        await this.requireManage(userId, organizationId);
        const interaction = await this.resolveInteraction(userId, organizationId, interactionId);
        if (interaction.status === ClassroomInteractionStatus.ACTIVE) {
            throw HttpErrorFactory.conflict("请先结束课堂活动再删除");
        }
        const events = await this.eventRepository.find({
            where: { interactionId: interaction.id },
        });
        if (events.length) await this.eventRepository.softRemove(events);
        await this.interactionRepository.softRemove(interaction);
        return { success: true, removed: interaction.name };
    }

    /**
     * 开始活动：先把场景应用到全部目标智能体，任何一个失败都不进入进行中，
     * 与旧 console 行为一致。成功后清空上一场的完成记录，大屏从零开始。
     */
    async startInteraction(
        userId: string,
        organizationId: string | null | undefined,
        interactionId: string,
    ) {
        await this.requireManage(userId, organizationId);
        const interaction = await this.resolveInteraction(userId, organizationId, interactionId);
        if (interaction.status === ClassroomInteractionStatus.ACTIVE) {
            throw HttpErrorFactory.conflict("该课堂活动已经开始");
        }
        const active = await this.interactionRepository.findOne({
            where: {
                status: ClassroomInteractionStatus.ACTIVE,
                ...this.workspaceWhere(userId, organizationId),
            },
        });
        if (active) throw HttpErrorFactory.conflict("已有其他课堂活动正在进行");

        const execution = await this.automationService.applyScene(
            userId,
            organizationId,
            interaction.sceneId,
            interaction.targets,
        );
        if (execution.failed > 0) {
            throw HttpErrorFactory.conflict(
                `场景应用失败：${execution.failed} 个智能体未更新，活动尚未开始`,
            );
        }

        const staleEvents = await this.eventRepository.find({
            where: { interactionId: interaction.id },
        });
        if (staleEvents.length) await this.eventRepository.softRemove(staleEvents);

        interaction.status = ClassroomInteractionStatus.ACTIVE;
        interaction.startedAt = new Date();
        interaction.endedAt = null;
        const saved = await this.interactionRepository.save(interaction);
        const [decorated] = await this.decorateWithSceneName([saved]);
        return { interaction: decorated, execution };
    }

    async endInteraction(
        userId: string,
        organizationId: string | null | undefined,
        interactionId: string,
    ) {
        await this.requireManage(userId, organizationId);
        const interaction = await this.resolveInteraction(userId, organizationId, interactionId);
        if (interaction.status !== ClassroomInteractionStatus.ACTIVE) {
            throw HttpErrorFactory.conflict("该课堂活动当前未在进行");
        }
        interaction.status = ClassroomInteractionStatus.ENDED;
        interaction.endedAt = new Date();
        const saved = await this.interactionRepository.save(interaction);
        const [decorated] = await this.decorateWithSceneName([saved]);
        return decorated;
    }

    async listEvents(
        userId: string,
        organizationId: string | null | undefined,
        interactionId: string,
        limit = 100,
    ) {
        await this.requireRead(userId, organizationId);
        const interaction = await this.resolveInteraction(userId, organizationId, interactionId);
        return this.eventRepository.find({
            where: { interactionId: interaction.id },
            order: { occurredAt: "DESC" },
            take: Math.min(Math.max(limit, 1), PUBLIC_EVENT_LIMIT),
        });
    }

    /**
     * 记录一条课堂完成事件。MCP 网关收到智能体的「课堂任务完成」上报后调用；
     * 管理端的测试事件也走这里。不做登录校验——调用方只有智能体绑定ID。
     *
     * 找到该智能体所属工作空间里唯一「进行中」且目标包含该智能体的活动，
     * 找不到则拒绝（accepted=false），由调用方决定如何提示。
     */
    async recordEvent(
        agentBindingId: string,
        input: ClassroomEventInput,
    ): Promise<ClassroomEventResult> {
        const agent = await this.agentRepository.findOne({ where: { id: agentBindingId } });
        if (!agent) return { accepted: false };

        const interactions = await this.interactionRepository.find({
            where: {
                status: ClassroomInteractionStatus.ACTIVE,
                ...(agent.organizationId
                    ? { organizationId: agent.organizationId }
                    : { organizationId: IsNull(), ownerUserId: agent.ownerUserId }),
            },
        });
        const interaction = interactions.find((item) =>
            item.targets.some((target) => target.agentId === agent.id),
        );
        if (!interaction) return { accepted: false };

        const target = interaction.targets.find((item) => item.agentId === agent.id);
        const event = await this.eventRepository.save(
            this.eventRepository.create({
                interactionId: interaction.id,
                agentBindingId: agent.id,
                agentName: target?.agentName || agent.name,
                taskKey: input.taskKey?.trim().slice(0, 120) || "",
                summary: input.summary.trim().slice(0, 300),
                score: input.score ?? null,
                occurredAt: new Date(),
            }),
        );
        return { accepted: true, event, interactionId: interaction.id };
    }

    /** 订阅 MCP 网关的任务完成事件，把回执转发给设备侧。 */
    @OnEvent(XIAOZHI_MCP_TASK_COMPLETED_EVENT)
    async handleMcpTaskCompleted(
        payload: XiaozhiMcpTaskCompletedEvent,
    ): Promise<XiaozhiMcpTaskCompletedAck> {
        const result = await this.recordEvent(payload.agentBindingId, {
            taskKey: payload.taskKey,
            summary: payload.summary,
            score: payload.score,
        });
        return {
            accepted: result.accepted,
            eventId: result.event?.id ?? null,
            reason: result.accepted ? undefined : "no_active_classroom",
        };
    }

    /** 管理端手动触发一条测试事件，验证大屏链路。 */
    async createTestEvent(
        userId: string,
        organizationId: string | null | undefined,
        dto: ClassroomTestEventDto,
    ) {
        await this.requireManage(userId, organizationId);
        const agent = await this.agentRepository.findOne({
            where: { id: dto.agentId, ...this.workspaceWhere(userId, organizationId) },
        });
        if (!agent) throw HttpErrorFactory.notFound("方糖猫智能体不存在");

        const result = await this.recordEvent(agent.id, {
            taskKey: dto.taskKey,
            summary: dto.summary,
            score: dto.score ?? null,
        });
        if (!result.accepted || !result.event) {
            throw HttpErrorFactory.conflict("当前智能体没有进行中的课堂活动");
        }
        return result.event;
    }

    /**
     * 公开大屏数据，无需登录。只返回展示必需的字段，
     * 绝不能带出 organizationId、ownerUserId 等内部信息。
     */
    async getPublicDisplay(publicId: string) {
        if (!PUBLIC_ID_PATTERN.test(publicId)) {
            throw HttpErrorFactory.notFound("课堂展示不存在");
        }
        const interaction = await this.interactionRepository.findOne({ where: { publicId } });
        if (!interaction) throw HttpErrorFactory.notFound("课堂展示不存在");

        const events =
            interaction.status === ClassroomInteractionStatus.DRAFT
                ? []
                : await this.eventRepository.find({
                      where: { interactionId: interaction.id },
                      order: { occurredAt: "DESC" },
                      take: PUBLIC_EVENT_LIMIT,
                  });

        return {
            interaction: {
                name: interaction.name,
                status: interaction.status,
                startedAt: interaction.startedAt,
                endedAt: interaction.endedAt,
                displayConfig: interaction.displayConfig,
                targets: interaction.targets,
            },
            events: events.map((event) => ({
                id: event.id,
                agentId: event.agentBindingId,
                agentName: event.agentName,
                taskKey: event.taskKey,
                summary: event.summary,
                score: event.score,
                occurredAt: event.occurredAt,
            })),
        };
    }
}
