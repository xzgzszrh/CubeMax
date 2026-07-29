import { CLASSROOM_DEVICE_CONFIG_KEYS } from "@buildingai/core/modules/classroom";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    XiaozhiAgentBinding,
    XiaozhiQuickCommand,
    type XiaozhiQuickCommandTarget,
    XiaozhiScene,
} from "@buildingai/db/entities";
import { In, IsNull, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { OrganizationPermission } from "../constants/organization-permissions";
import type { SaveXiaozhiQuickCommandDto, SaveXiaozhiSceneDto } from "../dto/organization.dto";
import { OrganizationService } from "./organization.service";
import { XiaozhiService } from "./xiaozhi.service";

/**
 * Only these fields are captured into and re-applied from a scene. Shared with
 * the classroom app-session snapshot/restore path so both cover the same
 * surface — a field one writes but the other cannot restore would be left
 * permanently altered on a student's device.
 */
const SCENE_CONFIG_KEYS = CLASSROOM_DEVICE_CONFIG_KEYS;

const APPLY_CONCURRENCY = 4;

export type SceneApplyResult = {
    agentId: string;
    agentName: string;
    success: boolean;
    message?: string;
};

async function mapLimit<T, R>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await task(items[index] as T);
        }
    });
    await Promise.all(workers);
    return results;
}

@Injectable()
export class XiaozhiAutomationService {
    constructor(
        @InjectRepository(XiaozhiScene)
        private readonly sceneRepository: Repository<XiaozhiScene>,
        @InjectRepository(XiaozhiQuickCommand)
        private readonly commandRepository: Repository<XiaozhiQuickCommand>,
        @InjectRepository(XiaozhiAgentBinding)
        private readonly agentRepository: Repository<XiaozhiAgentBinding>,
        private readonly organizationService: OrganizationService,
        private readonly xiaozhiService: XiaozhiService,
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

    private sanitizeConfig(config: Record<string, unknown>) {
        return Object.fromEntries(
            SCENE_CONFIG_KEYS.flatMap((key) => (key in config ? [[key, config[key]]] : [])),
        );
    }

    /** Resolve the scene payload: either an inline config or a copy of one agent. */
    private async resolveSceneInput(
        userId: string,
        organizationId: string | null | undefined,
        dto: SaveXiaozhiSceneDto,
    ) {
        if (dto.sourceAgentId) {
            const { agent, config } = await this.xiaozhiService.captureAgentConfig(
                userId,
                organizationId,
                dto.sourceAgentId,
            );
            return {
                config: this.sanitizeConfig(config),
                sourceAgentId: agent.id,
                sourceAgentName: agent.name,
            };
        }
        const config = this.sanitizeConfig(dto.config || {});
        if (!Object.keys(config).length) {
            throw HttpErrorFactory.badRequest("需要提供场景配置或复制来源智能体");
        }
        return { config, sourceAgentId: null, sourceAgentName: "" };
    }

    async listScenes(userId: string, organizationId?: string | null) {
        await this.requireRead(userId, organizationId);
        return this.sceneRepository.find({
            where: this.workspaceWhere(userId, organizationId),
            order: { updatedAt: "DESC" },
        });
    }

    async createScene(
        userId: string,
        organizationId: string | null | undefined,
        dto: SaveXiaozhiSceneDto,
    ) {
        await this.requireManage(userId, organizationId);
        const resolved = await this.resolveSceneInput(userId, organizationId, dto);
        return this.sceneRepository.save(
            this.sceneRepository.create({
                organizationId: organizationId || null,
                ownerUserId: userId,
                name: dto.name.trim(),
                description: dto.description?.trim() || "",
                ...resolved,
            }),
        );
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

    async updateScene(
        userId: string,
        organizationId: string | null | undefined,
        sceneId: string,
        dto: SaveXiaozhiSceneDto,
    ) {
        await this.requireManage(userId, organizationId);
        const scene = await this.resolveScene(userId, organizationId, sceneId);
        const resolved = await this.resolveSceneInput(userId, organizationId, dto);
        scene.name = dto.name.trim();
        scene.description = dto.description?.trim() || "";
        scene.config = resolved.config;
        scene.sourceAgentId = resolved.sourceAgentId;
        scene.sourceAgentName = resolved.sourceAgentName;
        return this.sceneRepository.save(scene);
    }

    async removeScene(userId: string, organizationId: string | null | undefined, sceneId: string) {
        await this.requireManage(userId, organizationId);
        const scene = await this.resolveScene(userId, organizationId, sceneId);
        // Quick commands referencing the scene can no longer run; remove them too.
        const commands = await this.commandRepository.find({ where: { sceneId: scene.id } });
        if (commands.length) await this.commandRepository.softRemove(commands);
        await this.sceneRepository.softRemove(scene);
        return { success: true, removed: scene.name, removedCommands: commands.length };
    }

    /**
     * Push one scene's config to every target agent. Per-target failures are
     * reported instead of aborting the batch, matching the old console.
     */
    async applyScene(
        userId: string,
        organizationId: string | null | undefined,
        sceneId: string,
        targets: XiaozhiQuickCommandTarget[],
    ) {
        await this.requireManage(userId, organizationId);
        const scene = await this.resolveScene(userId, organizationId, sceneId);
        const results = await mapLimit(
            targets,
            APPLY_CONCURRENCY,
            async (target): Promise<SceneApplyResult> => {
                try {
                    await this.xiaozhiService.updateAgentConfig(
                        userId,
                        organizationId,
                        target.agentId,
                        scene.config,
                    );
                    return { agentId: target.agentId, agentName: target.agentName, success: true };
                } catch (error) {
                    return {
                        agentId: target.agentId,
                        agentName: target.agentName,
                        success: false,
                        message: error instanceof Error ? error.message : "应用失败",
                    };
                }
            },
        );
        const failed = results.filter((result) => !result.success).length;
        return {
            sceneId: scene.id,
            sceneName: scene.name,
            results,
            succeeded: results.length - failed,
            failed,
            status: failed === 0 ? "success" : failed === results.length ? "failed" : "partial",
        };
    }

    async applySceneToAgents(
        userId: string,
        organizationId: string | null | undefined,
        sceneId: string,
        agentIds: string[],
    ) {
        const targets = await this.resolveTargets(userId, organizationId, agentIds);
        return this.applyScene(userId, organizationId, sceneId, targets);
    }

    /** Map agent binding ids to name-carrying targets, rejecting foreign agents. */
    private async resolveTargets(
        userId: string,
        organizationId: string | null | undefined,
        agentIds: string[],
    ): Promise<XiaozhiQuickCommandTarget[]> {
        const agents = await this.agentRepository.find({
            where: { id: In(agentIds), ...this.workspaceWhere(userId, organizationId) },
        });
        const byId = new Map(agents.map((agent) => [agent.id, agent]));
        const missing = agentIds.filter((id) => !byId.has(id));
        if (missing.length) {
            throw HttpErrorFactory.badRequest("部分目标智能体不存在或不属于当前工作空间");
        }
        return agentIds.map((id) => {
            const agent = byId.get(id) as XiaozhiAgentBinding;
            return { agentId: agent.id, agentName: agent.name };
        });
    }

    async listCommands(userId: string, organizationId?: string | null) {
        await this.requireRead(userId, organizationId);
        return this.commandRepository.find({
            where: this.workspaceWhere(userId, organizationId),
            order: { pinned: "DESC", updatedAt: "DESC" },
        });
    }

    async createCommand(
        userId: string,
        organizationId: string | null | undefined,
        dto: SaveXiaozhiQuickCommandDto,
    ) {
        await this.requireManage(userId, organizationId);
        const scene = await this.resolveScene(userId, organizationId, dto.sceneId);
        const targets = await this.resolveTargets(userId, organizationId, dto.agentIds);
        return this.commandRepository.save(
            this.commandRepository.create({
                organizationId: organizationId || null,
                ownerUserId: userId,
                name: dto.name.trim(),
                sceneId: scene.id,
                pinned: dto.pinned ?? false,
                targets,
            }),
        );
    }

    private async resolveCommand(
        userId: string,
        organizationId: string | null | undefined,
        commandId: string,
    ) {
        const command = await this.commandRepository.findOne({
            where: { id: commandId, ...this.workspaceWhere(userId, organizationId) },
        });
        if (!command) throw HttpErrorFactory.notFound("快捷指令不存在");
        return command;
    }

    async updateCommand(
        userId: string,
        organizationId: string | null | undefined,
        commandId: string,
        dto: SaveXiaozhiQuickCommandDto,
    ) {
        await this.requireManage(userId, organizationId);
        const command = await this.resolveCommand(userId, organizationId, commandId);
        const scene = await this.resolveScene(userId, organizationId, dto.sceneId);
        command.name = dto.name.trim();
        command.sceneId = scene.id;
        command.pinned = dto.pinned ?? false;
        command.targets = await this.resolveTargets(userId, organizationId, dto.agentIds);
        return this.commandRepository.save(command);
    }

    async removeCommand(
        userId: string,
        organizationId: string | null | undefined,
        commandId: string,
    ) {
        await this.requireManage(userId, organizationId);
        const command = await this.resolveCommand(userId, organizationId, commandId);
        await this.commandRepository.softRemove(command);
        return { success: true, removed: command.name };
    }

    async executeCommand(
        userId: string,
        organizationId: string | null | undefined,
        commandId: string,
    ) {
        await this.requireManage(userId, organizationId);
        const command = await this.resolveCommand(userId, organizationId, commandId);
        return this.applyScene(userId, organizationId, command.sceneId, command.targets);
    }
}
