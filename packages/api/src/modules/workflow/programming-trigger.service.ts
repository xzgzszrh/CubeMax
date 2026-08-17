import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { ProgrammingTrigger } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import {
    CreateProgrammingTriggerDto,
    ExecuteProgrammingTriggerDto,
    QueryProgrammingTriggerDto,
    UpdateProgrammingTriggerDto,
} from "./programming-trigger.dto";
import {
    extractProgrammingInputSchema,
    validateProgrammingInputs,
} from "./programming-trigger.schema";
import { WorkflowRuntimeExecutionService } from "./workflow-runtime-execution.service";
import { ProgrammingProjectService } from "./programming-project.service";

export type ProgrammingTriggerDetail = ProgrammingTrigger & {
    project: {
        id: string;
        name: string;
        isPublished: boolean;
        runtimeTarget: string;
        mainWorkflowId: string;
    };
};

export type ProgrammingTriggerListResult = {
    items: ProgrammingTriggerDetail[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

@Injectable()
export class ProgrammingTriggerService {
    constructor(
        @InjectRepository(ProgrammingTrigger)
        private readonly triggerRepository: Repository<ProgrammingTrigger>,
        private readonly programmingProjectService: ProgrammingProjectService,
        private readonly runtimeExecutionService: WorkflowRuntimeExecutionService,
    ) {}

    async findAll(
        userId: string,
        query: QueryProgrammingTriggerDto,
    ): Promise<ProgrammingTriggerListResult> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 50;
        const keyword = query.keyword?.trim();
        const qb = this.triggerRepository
            .createQueryBuilder("trigger")
            .where("trigger.createBy = :userId", { userId })
            .orderBy("trigger.isPinned", "DESC")
            .addOrderBy("trigger.homeOrder", "ASC")
            .addOrderBy("trigger.updatedAt", "DESC")
            .skip((page - 1) * pageSize)
            .take(pageSize);

        if (keyword) {
            qb.andWhere("(trigger.name ILIKE :keyword OR trigger.description ILIKE :keyword)", {
                keyword: `%${keyword}%`,
            });
        }
        if (query.isPinned !== undefined) qb.andWhere("trigger.isPinned = :isPinned", query);
        if (query.isEnabled !== undefined) qb.andWhere("trigger.isEnabled = :isEnabled", query);

        const [items, total] = await qb.getManyAndCount();
        return {
            items: await Promise.all(items.map((item) => this.toDetail(item, userId))),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    async findOne(id: string, userId: string): Promise<ProgrammingTrigger> {
        const trigger = await this.triggerRepository.findOne({ where: { id, createBy: userId } });
        if (!trigger) throw HttpErrorFactory.notFound("触发器不存在");
        return trigger;
    }

    async findDetail(id: string, userId: string): Promise<ProgrammingTriggerDetail> {
        return this.toDetail(await this.findOne(id, userId), userId);
    }

    async create(
        userId: string,
        dto: CreateProgrammingTriggerDto,
    ): Promise<ProgrammingTriggerDetail> {
        const project = await this.programmingProjectService.findDetail(dto.projectId, userId);
        const trigger = await this.triggerRepository.save(
            this.triggerRepository.create({
                name: dto.name,
                description: dto.description ?? "",
                projectId: project.id,
                triggerType: dto.triggerType ?? "form",
                inputSchema: extractProgrammingInputSchema(project.mainWorkflow.schema),
                isEnabled: dto.isEnabled ?? true,
                isPinned: dto.isPinned ?? false,
                homeOrder: dto.homeOrder ?? 0,
                createBy: userId,
            }),
        );
        return this.toDetail(trigger, userId);
    }

    async update(
        id: string,
        userId: string,
        dto: UpdateProgrammingTriggerDto,
    ): Promise<ProgrammingTriggerDetail> {
        const trigger = await this.findOne(id, userId);
        let projectId = trigger.projectId;
        if (dto.name !== undefined) trigger.name = dto.name;
        if (dto.description !== undefined) trigger.description = dto.description;
        if (dto.triggerType !== undefined) trigger.triggerType = dto.triggerType;
        if (dto.isEnabled !== undefined) trigger.isEnabled = dto.isEnabled;
        if (dto.isPinned !== undefined) trigger.isPinned = dto.isPinned;
        if (dto.homeOrder !== undefined) trigger.homeOrder = dto.homeOrder;

        if (dto.projectId !== undefined && dto.projectId !== trigger.projectId) {
            const project = await this.programmingProjectService.findDetail(dto.projectId, userId);
            projectId = project.id;
            trigger.inputSchema = extractProgrammingInputSchema(project.mainWorkflow.schema);
        }
        trigger.projectId = projectId;
        await this.triggerRepository.save(trigger);
        return this.toDetail(trigger, userId);
    }

    async remove(id: string, userId: string): Promise<void> {
        const trigger = await this.findOne(id, userId);
        await this.triggerRepository.remove(trigger);
    }

    async execute(id: string, userId: string, dto: ExecuteProgrammingTriggerDto) {
        const trigger = await this.findOne(id, userId);
        if (!trigger.isEnabled) throw HttpErrorFactory.badRequest("该触发器已停用");

        const validation = validateProgrammingInputs(trigger.inputSchema, dto.inputs);
        if ("message" in validation) {
            throw HttpErrorFactory.badRequest(validation.message);
        }

        const project = await this.programmingProjectService.findOne(trigger.projectId, userId);
        if (!project.isPublished) {
            throw HttpErrorFactory.badRequest("请先发布触发器绑定的编程工程");
        }

        return this.runtimeExecutionService.runPublishedProject(
            project.id,
            { id: userId },
            validation.inputs,
        );
    }

    private async toDetail(
        trigger: ProgrammingTrigger,
        userId: string,
    ): Promise<ProgrammingTriggerDetail> {
        const project = await this.programmingProjectService.findOne(trigger.projectId, userId);
        return Object.assign(trigger, {
            project: {
                id: project.id,
                name: project.name,
                isPublished: project.isPublished,
                runtimeTarget: project.runtimeTarget,
                mainWorkflowId: project.mainWorkflowId || "",
            },
        });
    }
}
