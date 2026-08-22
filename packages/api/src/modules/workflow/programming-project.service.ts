import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    AiWorkflow,
    LuaModule,
    ProgrammingProject,
    type ProgrammingProjectPublishedSnapshot,
    ProgrammingProjectTool,
    type ProgrammingProjectToolSnapshot,
    type ProgrammingRuntimeTarget,
    ProgrammingTrigger,
} from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { LuaDeviceGatewayService } from "@modules/lua-device/lua-device-gateway.service";
import { Injectable } from "@nestjs/common";

import type { CreateLuaModuleDto, QueryLuaModuleDto } from "../lua/lua-module.dto";
import { CreateLuaDeviceRunDto } from "../lua-device/lua-device.dto";
import { LuaModuleService } from "../lua/lua-module.service";
import { XiaozhiService } from "../organization/services/xiaozhi.service";
import { SimulatorService } from "../simulator/simulator.service";
import { WorkflowRuntimeDeviceService } from "./workflow-runtime-device.service";
import type { SimulatorBoardType } from "../simulator/simulator.types";
import {
    CreateProgrammingProjectDto,
    ProgrammingProjectToolDto,
    QueryProgrammingProjectDto,
    UpdateProgrammingProjectDto,
} from "./programming-project.dto";
import { WorkflowService } from "./workflow.service";

type WorkflowReferences = {
    luaModuleIds: string[];
    tools: ProgrammingProjectToolSnapshot[];
};

export type ProgrammingProjectDetail = ProgrammingProject & {
    mainWorkflow: AiWorkflow;
    tools: ProgrammingProjectToolSnapshot[];
    luaModuleCount: number;
};

export type ProgrammingProjectListResult = {
    items: ProgrammingProjectDetail[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function uniqueTools(tools: ProgrammingProjectToolSnapshot[]): ProgrammingProjectToolSnapshot[] {
    const seen = new Set<string>();
    return tools.filter((tool) => {
        const key = `${tool.mcpServerId}\u0000${tool.toolName}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function isPopulatedSchema(schema?: Record<string, unknown>): schema is Record<string, unknown> {
    return Boolean(schema && Array.isArray(schema.nodes) && schema.nodes.length > 0);
}

function defaultMainWorkflowSchema(): Record<string, unknown> {
    return {
        nodes: [
            {
                id: "start_0",
                type: "start",
                meta: { position: { x: 180, y: 300 } },
                data: { title: "开始", outputs: { type: "object", properties: {} } },
            },
            {
                id: "end_0",
                type: "end",
                meta: { position: { x: 640, y: 300 } },
                data: {
                    title: "结束",
                    inputsValues: {},
                    inputs: { type: "object", properties: {} },
                },
            },
        ],
        edges: [{ sourceNodeID: "start_0", targetNodeID: "end_0" }],
        globalVariable: { type: "object", required: [], properties: {} },
    };
}

@Injectable()
export class ProgrammingProjectService {
    constructor(
        @InjectRepository(ProgrammingProject)
        private readonly projectRepository: Repository<ProgrammingProject>,
        @InjectRepository(ProgrammingProjectTool)
        private readonly projectToolRepository: Repository<ProgrammingProjectTool>,
        @InjectRepository(AiWorkflow)
        private readonly workflowRepository: Repository<AiWorkflow>,
        @InjectRepository(LuaModule)
        private readonly luaModuleRepository: Repository<LuaModule>,
        private readonly workflowService: WorkflowService,
        private readonly luaModuleService: LuaModuleService,
        private readonly simulatorService: SimulatorService,
        private readonly luaDeviceGatewayService: LuaDeviceGatewayService,
        private readonly xiaozhiService: XiaozhiService,
        private readonly runtimeDeviceService: WorkflowRuntimeDeviceService,
    ) {}

    async findAll(
        userId: string,
        query: QueryProgrammingProjectDto,
    ): Promise<ProgrammingProjectListResult> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 50;
        const keyword = query.keyword?.trim();
        const qb = this.projectRepository
            .createQueryBuilder("project")
            .where("project.createBy = :userId", { userId })
            .orderBy("project.updatedAt", "DESC")
            .addOrderBy("project.createdAt", "DESC")
            .skip((page - 1) * pageSize)
            .take(pageSize);

        if (keyword) {
            qb.andWhere("(project.name ILIKE :keyword OR project.description ILIKE :keyword)", {
                keyword: `%${keyword}%`,
            });
        }

        const [projects, total] = await qb.getManyAndCount();
        const items = await Promise.all(projects.map((project) => this.toDetail(project)));
        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    async findOne(id: string, userId: string): Promise<ProgrammingProject> {
        const project = await this.projectRepository.findOne({ where: { id, createBy: userId } });
        if (!project) throw HttpErrorFactory.notFound("编程工程不存在");
        return project;
    }

    async findDetail(id: string, userId: string): Promise<ProgrammingProjectDetail> {
        return this.toDetail(await this.findOne(id, userId));
    }

    async create(
        userId: string,
        dto: CreateProgrammingProjectDto,
    ): Promise<ProgrammingProjectDetail> {
        const project = await this.projectRepository.manager.transaction(async (manager) => {
            const projectRepository = manager.getRepository(ProgrammingProject);
            const workflowRepository = manager.getRepository(AiWorkflow);
            const createdProject = await projectRepository.save(
                projectRepository.create({
                    name: dto.name,
                    description: dto.description ?? "",
                    projectType: dto.projectType ?? "conversation",
                    createBy: userId,
                    runtimeTarget: "local",
                    isPublished: false,
                }),
            );
            const workflow = await workflowRepository.save(
                workflowRepository.create({
                    name: dto.name,
                    description: dto.description ?? "",
                    schema: isPopulatedSchema(dto.schema)
                        ? dto.schema
                        : defaultMainWorkflowSchema(),
                    createBy: userId,
                    projectId: createdProject.id,
                    isMain: true,
                    isPublished: false,
                }),
            );
            createdProject.mainWorkflowId = workflow.id;
            return projectRepository.save(createdProject);
        });
        return this.toDetail(project);
    }

    async update(
        id: string,
        userId: string,
        dto: UpdateProgrammingProjectDto,
    ): Promise<ProgrammingProjectDetail> {
        const project = await this.findOne(id, userId);
        if (dto.name !== undefined) project.name = dto.name;
        if (dto.description !== undefined) project.description = dto.description;

        const target = dto.runtimeTarget ?? project.runtimeTarget;
        let simulatorSessionId =
            dto.simulatorSessionId !== undefined
                ? dto.simulatorSessionId
                : project.simulatorSessionId;
        let deviceId = dto.deviceId !== undefined ? dto.deviceId : project.deviceId;
        let xiaozhiAgentId =
            dto.xiaozhiAgentId !== undefined ? dto.xiaozhiAgentId || null : project.xiaozhiAgentId;

        if (target === "local") {
            simulatorSessionId = null;
            deviceId = null;
        } else if (target === "simulator") {
            this.assertApplicationOnly(project, "硬件仿真");
            if (!simulatorSessionId) {
                throw HttpErrorFactory.badRequest("请选择工程的仿真会话");
            }
            this.simulatorService.getForProjectUser(simulatorSessionId, userId, project.id);
            deviceId = null;
        } else if (xiaozhiAgentId) {
            await this.xiaozhiService.requireAccessibleAgent(userId, xiaozhiAgentId);
            deviceId = null;
            simulatorSessionId = null;
        } else if (deviceId) {
            const devices = await this.luaDeviceGatewayService.listAllDevices();
            if (!devices.some((device) => device.deviceId === deviceId.toLowerCase())) {
                throw HttpErrorFactory.notFound("CubeCat 设备不存在");
            }
            simulatorSessionId = null;
        } else {
            throw HttpErrorFactory.badRequest("请选择 CubeCat 设备");
        }

        project.runtimeTarget = target;
        project.simulatorSessionId = simulatorSessionId;
        project.deviceId = deviceId;
        project.xiaozhiAgentId = xiaozhiAgentId;
        const saved = await this.projectRepository.save(project);

        if (dto.name !== undefined || dto.description !== undefined) {
            const workflow = await this.getMainWorkflow(saved, userId);
            if (dto.name !== undefined) workflow.name = dto.name;
            if (dto.description !== undefined) workflow.description = dto.description;
            await this.workflowRepository.save(workflow);
        }

        return this.toDetail(saved);
    }

    async replaceTools(
        id: string,
        userId: string,
        tools: ProgrammingProjectToolDto[],
    ): Promise<ProgrammingProjectDetail> {
        const project = await this.findOne(id, userId);
        const deduped = uniqueTools(tools);
        await this.projectRepository.manager.transaction(async (manager) => {
            const repository = manager.getRepository(ProgrammingProjectTool);
            await repository.delete({ projectId: project.id });
            if (deduped.length) {
                await repository.save(
                    deduped.map((tool) => repository.create({ ...tool, projectId: project.id })),
                );
            }
        });
        project.updatedAt = new Date();
        await this.projectRepository.save(project);
        return this.toDetail(project);
    }

    async assertToolEnabled(
        projectId: string,
        userId: string,
        mcpServerId: string,
        toolName: string,
    ): Promise<void> {
        await this.findOne(projectId, userId);
        const enabled = await this.projectToolRepository.findOne({
            where: { projectId, mcpServerId, toolName },
        });
        if (!enabled) {
            throw HttpErrorFactory.badRequest(`工具 ${toolName} 未加入当前工程`);
        }
    }

    async publish(id: string, userId: string): Promise<ProgrammingProjectDetail> {
        const project = await this.findOne(id, userId);
        const workflow = await this.getMainWorkflow(project, userId);
        this.workflowService.assertPublishableSchema(workflow.schema, project.projectType);
        const schema = workflow.schema as Record<string, unknown>;
        const references = this.extractReferences(schema);
        const modules = await Promise.all(
            references.luaModuleIds.map(async (moduleId) => {
                const luaModule = await this.luaModuleService.findOne(moduleId, userId);
                if (luaModule.projectId !== project.id) {
                    throw HttpErrorFactory.badRequest(
                        `Lua 模块「${luaModule.name}」不属于当前工程`,
                    );
                }
                await this.luaModuleService.validateDraft(luaModule);
                return {
                    id: luaModule.id,
                    name: luaModule.name,
                    code: luaModule.draftCode,
                    inputSchema: luaModule.inputSchema as Record<string, unknown>,
                    outputSchema: luaModule.outputSchema as Record<string, unknown>,
                };
            }),
        );
        const enabledTools = await this.listToolRefs(project.id);
        const enabledToolKeys = new Set(
            enabledTools.map((tool) => `${tool.mcpServerId}\u0000${tool.toolName}`),
        );
        const unavailableTools = references.tools.filter(
            (tool) => !enabledToolKeys.has(`${tool.mcpServerId}\u0000${tool.toolName}`),
        );
        if (unavailableTools.length) {
            throw HttpErrorFactory.badRequest(
                `主流程引用了未加入工程的工具：${unavailableTools.map((tool) => tool.toolName).join("、")}`,
            );
        }
        await this.assertRuntimeTarget(project, userId);

        const publishedAt = new Date();
        const snapshot: ProgrammingProjectPublishedSnapshot = {
            version: 1,
            workflow: { id: workflow.id, name: workflow.name, schema },
            luaModules: modules,
            tools: enabledTools,
            runtime: {
                target: project.runtimeTarget,
                ...(project.simulatorSessionId
                    ? { simulatorSessionId: project.simulatorSessionId }
                    : {}),
                ...(project.deviceId ? { deviceId: project.deviceId } : {}),
                ...(project.xiaozhiAgentId ? { xiaozhiAgentId: project.xiaozhiAgentId } : {}),
            },
            publishedAt: publishedAt.toISOString(),
        };

        await this.projectRepository.manager.transaction(async (manager) => {
            workflow.isPublished = true;
            workflow.publishedAt = publishedAt;
            workflow.publishedSchema = schema;
            await manager.getRepository(AiWorkflow).save(workflow);

            project.isPublished = true;
            project.publishedAt = publishedAt;
            project.publishedSnapshot = snapshot;
            await manager.getRepository(ProgrammingProject).save(project);
        });

        return this.toDetail(project);
    }

    async unpublish(id: string, userId: string): Promise<ProgrammingProjectDetail> {
        const project = await this.findOne(id, userId);
        if (!project.isPublished) throw HttpErrorFactory.badRequest("该工程当前未发布");
        const workflow = await this.getMainWorkflow(project, userId);
        await this.projectRepository.manager.transaction(async (manager) => {
            project.isPublished = false;
            workflow.isPublished = false;
            await manager.getRepository(ProgrammingProject).save(project);
            await manager.getRepository(AiWorkflow).save(workflow);
        });
        return this.toDetail(project);
    }

    async findPublished(
        id: string,
        userId: string,
    ): Promise<{ project: ProgrammingProject; snapshot: ProgrammingProjectPublishedSnapshot }> {
        const project = await this.findOne(id, userId);
        if (!project.isPublished || !project.publishedSnapshot) {
            throw HttpErrorFactory.badRequest("该工程当前未发布");
        }
        return { project, snapshot: project.publishedSnapshot };
    }

    async remove(id: string, userId: string): Promise<void> {
        const project = await this.findOne(id, userId);
        this.simulatorService.removeForProject(project.id, userId);
        await this.projectRepository.manager.transaction(async (manager) => {
            await manager.getRepository(ProgrammingProjectTool).delete({ projectId: project.id });
            await manager
                .getRepository(ProgrammingTrigger)
                .delete({ projectId: project.id, createBy: userId });
            await manager.getRepository(LuaModule).delete({ projectId: project.id });
            await manager.getRepository(AiWorkflow).delete({ projectId: project.id });
            await manager
                .getRepository(ProgrammingProject)
                .delete({ id: project.id, createBy: userId });
        });
    }

    async listLuaModules(userId: string, projectId: string, query: QueryLuaModuleDto) {
        const project = await this.findOne(projectId, userId);
        this.assertApplicationOnly(project, "Lua 模块");
        return this.luaModuleService.findAll(userId, { ...query, projectId });
    }

    async createLuaModule(userId: string, projectId: string, dto: CreateLuaModuleDto) {
        const project = await this.findOne(projectId, userId);
        this.assertApplicationOnly(project, "Lua 模块");
        return this.luaModuleService.create(userId, dto, projectId);
    }

    async listUnassignedLuaModules(userId: string, projectId: string) {
        const project = await this.findOne(projectId, userId);
        this.assertApplicationOnly(project, "Lua 模块");
        return this.luaModuleService.findAll(userId, {
            page: 1,
            pageSize: 100,
            unassigned: true,
        });
    }

    async importLuaModule(userId: string, projectId: string, moduleId: string) {
        const project = await this.findOne(projectId, userId);
        this.assertApplicationOnly(project, "Lua 模块");
        return this.luaModuleService.cloneIntoProject(moduleId, userId, projectId);
    }

    async listSimulatorSessions(userId: string, projectId: string) {
        const project = await this.findOne(projectId, userId);
        this.assertApplicationOnly(project, "硬件仿真");
        return this.simulatorService.list(userId, projectId);
    }

    async createSimulatorSession(
        userId: string,
        projectId: string,
        name?: string,
        boardType?: SimulatorBoardType,
    ) {
        const project = await this.findOne(projectId, userId);
        this.assertApplicationOnly(project, "硬件仿真");
        return this.simulatorService.create(userId, name, boardType, projectId);
    }

    async getRuntimeSelection(projectId: string, userId: string) {
        const project = await this.findOne(projectId, userId);
        await this.assertRuntimeTarget(project, userId);
        let deviceId = project.deviceId ?? undefined;
        if (project.runtimeTarget === "device") {
            deviceId = await this.runtimeDeviceService.resolveLuaDeviceId(userId, {
                runtimeTarget: "device",
                xiaozhiAgentId: project.xiaozhiAgentId ?? undefined,
                deviceId: project.xiaozhiAgentId ? undefined : deviceId,
            });
        }
        return {
            projectId: project.id,
            runtimeTarget: project.runtimeTarget,
            simulatorSessionId: project.simulatorSessionId ?? undefined,
            deviceId,
            xiaozhiAgentId: project.xiaozhiAgentId ?? undefined,
        };
    }

    async createLuaRun(userId: string, projectId: string, dto: CreateLuaDeviceRunDto) {
        const project = await this.findOne(projectId, userId);
        this.assertApplicationOnly(project, "Lua 模块");
        if (project.runtimeTarget !== "device") {
            throw HttpErrorFactory.badRequest("请先把运行目标设为 CubeCat 设备");
        }
        const deviceId = await this.runtimeDeviceService.resolveLuaDeviceId(userId, {
            runtimeTarget: "device",
            xiaozhiAgentId: project.xiaozhiAgentId ?? undefined,
            deviceId: project.xiaozhiAgentId ? undefined : (project.deviceId ?? undefined),
        });
        return this.luaDeviceGatewayService.createRun(userId, deviceId, {
            ...dto,
            projectId: project.id,
        });
    }

    private async toDetail(project: ProgrammingProject): Promise<ProgrammingProjectDetail> {
        const [mainWorkflow, tools, luaModuleCount] = await Promise.all([
            this.getMainWorkflow(project, project.createBy),
            this.listToolRefs(project.id),
            this.luaModuleRepository.count({
                where: { projectId: project.id, createBy: project.createBy },
            }),
        ]);
        return Object.assign(project, { mainWorkflow, tools, luaModuleCount });
    }

    private async getMainWorkflow(
        project: ProgrammingProject,
        userId: string,
    ): Promise<AiWorkflow> {
        const workflow = project.mainWorkflowId
            ? await this.workflowRepository.findOne({
                  where: { id: project.mainWorkflowId, projectId: project.id, createBy: userId },
              })
            : await this.workflowRepository.findOne({
                  where: { projectId: project.id, createBy: userId, isMain: true },
              });
        if (!workflow) throw HttpErrorFactory.badRequest("工程缺少主流程");
        return workflow;
    }

    private async listToolRefs(projectId: string): Promise<ProgrammingProjectToolSnapshot[]> {
        const rows = await this.projectToolRepository.find({
            where: { projectId },
            order: { createdAt: "ASC" },
        });
        return rows.map(({ mcpServerId, toolName }) => ({ mcpServerId, toolName }));
    }

    private extractReferences(schema: Record<string, unknown>): WorkflowReferences {
        const luaModuleIds = new Set<string>();
        const tools: ProgrammingProjectToolSnapshot[] = [];
        const seen = new Set<object>();
        const visit = (value: unknown): void => {
            if (!value || typeof value !== "object" || seen.has(value)) return;
            seen.add(value);
            if (Array.isArray(value)) {
                value.forEach(visit);
                return;
            }
            const node = value as Record<string, unknown>;
            const data = isRecord(node.data) ? node.data : undefined;
            if (typeof data?.luaModuleId === "string" && data.luaModuleId) {
                luaModuleIds.add(data.luaModuleId);
            }
            if (
                node.type === "mcp" &&
                typeof data?.mcpServerId === "string" &&
                data.mcpServerId &&
                typeof data.toolName === "string" &&
                data.toolName
            ) {
                tools.push({ mcpServerId: data.mcpServerId, toolName: data.toolName });
            }
            Object.values(node).forEach(visit);
        };
        visit(schema);
        return { luaModuleIds: [...luaModuleIds], tools: uniqueTools(tools) };
    }

    private assertApplicationOnly(project: ProgrammingProject, feature: string): void {
        if (project.projectType === "application") return;
        throw HttpErrorFactory.badRequest(`对话流工程不支持${feature}`);
    }

    private async assertRuntimeTarget(project: ProgrammingProject, userId: string): Promise<void> {
        if (project.runtimeTarget === "local") return;
        if (project.runtimeTarget === "simulator") {
            this.assertApplicationOnly(project, "硬件仿真");
            if (!project.simulatorSessionId) {
                throw HttpErrorFactory.badRequest("工程尚未选择仿真会话");
            }
            this.simulatorService.getForProjectUser(project.simulatorSessionId, userId, project.id);
            return;
        }
        if (project.xiaozhiAgentId) {
            await this.xiaozhiService.requireAccessibleAgent(userId, project.xiaozhiAgentId);
            return;
        }
        if (!project.deviceId) throw HttpErrorFactory.badRequest("请选择 CubeCat 设备");
        const devices = await this.luaDeviceGatewayService.listAllDevices();
        if (!devices.some((device) => device.deviceId === project.deviceId!.toLowerCase())) {
            throw HttpErrorFactory.notFound("CubeCat 设备不存在");
        }
    }
}
