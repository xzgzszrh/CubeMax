import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiWorkflow } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { CreateWorkflowDto, UpdateWorkflowDto } from "./workflow.dto";

@Injectable()
export class WorkflowService {
    constructor(
        @InjectRepository(AiWorkflow)
        private readonly workflowRepository: Repository<AiWorkflow>,
    ) {}

    async findAll(userId: string): Promise<AiWorkflow[]> {
        return this.workflowRepository.find({
            where: { createBy: userId },
            order: { createdAt: "DESC" },
        });
    }

    async findOne(id: string): Promise<AiWorkflow> {
        const workflow = await this.workflowRepository.findOne({ where: { id } });
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

    async update(id: string, dto: UpdateWorkflowDto): Promise<AiWorkflow> {
        const workflow = await this.findOne(id);
        Object.assign(workflow, dto);
        return this.workflowRepository.save(workflow);
    }

    async remove(id: string): Promise<void> {
        const workflow = await this.findOne(id);
        await this.workflowRepository.remove(workflow);
    }
}
