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

export interface PublishedWorkflowResult {
    id: string;
    name: string;
    description?: string;
    schema: object;
    publishedAt: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
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
            qb.andWhere("(workflow.name ILIKE :keyword OR workflow.description ILIKE :keyword)", {
                keyword: `%${keyword}%`,
            });
        }

        if (query.isPublished !== undefined) {
            qb.andWhere("workflow.isPublished = :isPublished", {
                isPublished: query.isPublished,
            });
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

    async publish(id: string, userId: string): Promise<AiWorkflow> {
        const workflow = await this.findOne(id, userId);
        this.assertPublishableSchema(workflow.schema);
        workflow.isPublished = true;
        workflow.publishedAt = new Date();
        workflow.publishedSchema = workflow.schema;

        return this.workflowRepository.save(workflow);
    }

    async unpublish(id: string, userId: string): Promise<AiWorkflow> {
        const workflow = await this.findOne(id, userId);
        if (!workflow.isPublished) {
            throw HttpErrorFactory.badRequest("该工作流当前未发布");
        }

        workflow.isPublished = false;
        return this.workflowRepository.save(workflow);
    }

    async findPublished(id: string, userId: string): Promise<PublishedWorkflowResult> {
        const workflow = await this.findOne(id, userId);
        if (!workflow.isPublished || !workflow.publishedSchema || !workflow.publishedAt) {
            throw HttpErrorFactory.badRequest("该工作流当前未发布");
        }

        return {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            schema: workflow.publishedSchema,
            publishedAt: workflow.publishedAt,
        };
    }

    assertPublishableSchema(schema?: object, projectType: "conversation" | "application" = "conversation"): void {
        if (!isRecord(schema) || !Array.isArray(schema.nodes) || !Array.isArray(schema.edges)) {
            throw HttpErrorFactory.badRequest("工作流结构不完整，无法发布");
        }

        const nodes = schema.nodes.flatMap((node) =>
            isRecord(node) && typeof node.id === "string" && typeof node.type === "string"
                ? [{ id: node.id, type: node.type }]
                : [],
        );
        const startIds = nodes.filter((node) => node.type === "start").map((node) => node.id);
        const endIds = new Set(nodes.filter((node) => node.type === "end").map((node) => node.id));
        if (!startIds.length) {
            throw HttpErrorFactory.badRequest("工作流必须包含开始节点");
        }
        // An application is an open-ended device program. It starts from one
        // entry node and may wait or loop forever, so it intentionally has no
        // conversational end/output contract.
        if (projectType === "application") return;
        if (!endIds.size) {
            throw HttpErrorFactory.badRequest("工作流必须包含开始节点和结束节点");
        }

        const adjacency = new Map<string, string[]>();
        schema.edges.forEach((edge) => {
            if (!isRecord(edge)) return;
            const source = edge.sourceNodeID ?? edge.source;
            const target = edge.targetNodeID ?? edge.target;
            if (typeof source !== "string" || typeof target !== "string") return;
            adjacency.set(source, [...(adjacency.get(source) ?? []), target]);
        });

        const visited = new Set<string>();
        const queue = [...startIds];
        while (queue.length) {
            const nodeId = queue.shift()!;
            if (endIds.has(nodeId)) return;
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);
            queue.push(...(adjacency.get(nodeId) ?? []));
        }

        throw HttpErrorFactory.badRequest("开始节点与结束节点之间没有可执行路径");
    }

    async remove(id: string, userId: string): Promise<void> {
        const workflow = await this.findOne(id, userId);
        if (workflow.projectId) {
            throw HttpErrorFactory.badRequest("主流程由编程工程管理，请从工程列表删除");
        }
        await this.workflowRepository.remove(workflow);
    }
}
