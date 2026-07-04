import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiWorkflow } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { CreateWorkflowDto, QueryWorkflowDto, UpdateWorkflowDto } from "./workflow.dto";

export interface WorkflowListResult {
    items: AiWorkflow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

@Injectable()
export class WorkflowService {
    constructor(
        @InjectRepository(AiWorkflow)
        private readonly workflowRepository: Repository<AiWorkflow>,
    ) {}

    async findAll(userId: string, query: QueryWorkflowDto): Promise<WorkflowListResult> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const keyword = query.keyword?.trim();

        const qb = this.workflowRepository
            .createQueryBuilder("workflow")
            .where("workflow.createBy = :userId", { userId })
            .orderBy("workflow.updatedAt", "DESC")
            .addOrderBy("workflow.createdAt", "DESC")
            .skip((page - 1) * pageSize)
            .take(pageSize);

        if (keyword) {
            qb.andWhere(
                "(workflow.name ILIKE :keyword OR workflow.description ILIKE :keyword)",
                { keyword: `%${keyword}%` },
            );
        }

        const [items, total] = await qb.getManyAndCount();

        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    async findOne(id: string, userId: string): Promise<AiWorkflow> {
        const workflow = await this.workflowRepository.findOne({ where: { id, createBy: userId } });
        if (!workflow) throw HttpErrorFactory.notFound("工作流不存在");
        return workflow;
    }

    async create(userId: string, dto: CreateWorkflowDto): Promise<AiWorkflow> {
        const workflow = this.workflowRepository.create({
            ...dto,
            createBy: userId,
        });

        return this.workflowRepository.save(workflow);
    }

    async update(id: string, userId: string, dto: UpdateWorkflowDto): Promise<AiWorkflow> {
        const workflow = await this.findOne(id, userId);

        if (dto.name !== undefined) workflow.name = dto.name;
        if (dto.description !== undefined) workflow.description = dto.description;
        if (dto.schema !== undefined) workflow.schema = dto.schema;

        return this.workflowRepository.save(workflow);
    }

    async remove(id: string, userId: string): Promise<void> {
        const workflow = await this.findOne(id, userId);
        await this.workflowRepository.remove(workflow);
    }
}
