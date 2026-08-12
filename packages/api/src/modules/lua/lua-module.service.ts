import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { LuaModule, type LuaModuleSchema } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import { CreateLuaModuleDto, QueryLuaModuleDto, UpdateLuaModuleDto } from "./lua-module.dto";
import { LuaRuntimeService, type LuaExecutionResult } from "./lua-runtime.service";

export interface LuaModuleListResult {
    items: LuaModule[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

@Injectable()
export class LuaModuleService {
    constructor(
        @InjectRepository(LuaModule)
        private readonly luaModuleRepository: Repository<LuaModule>,
        private readonly luaRuntimeService: LuaRuntimeService,
    ) {}

    async findAll(userId: string, query: QueryLuaModuleDto): Promise<LuaModuleListResult> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 50;
        const keyword = query.keyword?.trim();
        const qb = this.luaModuleRepository
            .createQueryBuilder("luaModule")
            .where("luaModule.createBy = :userId", { userId })
            .orderBy("luaModule.updatedAt", "DESC")
            .skip((page - 1) * pageSize)
            .take(pageSize);

        if (keyword) {
            qb.andWhere("(luaModule.name ILIKE :keyword OR luaModule.description ILIKE :keyword)", {
                keyword: `%${keyword}%`,
            });
        }
        if (query.isPublished !== undefined) {
            qb.andWhere("luaModule.isPublished = :isPublished", { isPublished: query.isPublished });
        }

        const [items, total] = await qb.getManyAndCount();
        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }

    async findOne(id: string, userId: string): Promise<LuaModule> {
        const luaModule = await this.luaModuleRepository.findOne({
            where: { id, createBy: userId },
        });
        if (!luaModule) throw HttpErrorFactory.notFound("Lua 模块不存在");
        return luaModule;
    }

    async create(userId: string, dto: CreateLuaModuleDto): Promise<LuaModule> {
        this.assertSchema(dto.inputSchema, "输入");
        this.assertSchema(dto.outputSchema, "输出");
        return this.luaModuleRepository.save(
            this.luaModuleRepository.create({ ...dto, createBy: userId }),
        );
    }

    async update(id: string, userId: string, dto: UpdateLuaModuleDto): Promise<LuaModule> {
        const luaModule = await this.findOne(id, userId);
        if (dto.inputSchema) this.assertSchema(dto.inputSchema, "输入");
        if (dto.outputSchema) this.assertSchema(dto.outputSchema, "输出");
        Object.assign(luaModule, dto);
        return this.luaModuleRepository.save(luaModule);
    }

    async test(
        id: string,
        userId: string,
        params: Record<string, unknown>,
        code?: string,
    ): Promise<LuaExecutionResult> {
        const luaModule = await this.findOne(id, userId);
        return this.luaRuntimeService.execute(code ?? luaModule.draftCode, params);
    }

    async publish(id: string, userId: string): Promise<LuaModule> {
        const luaModule = await this.findOne(id, userId);
        await this.luaRuntimeService.validate(luaModule.draftCode);
        luaModule.publishedCode = luaModule.draftCode;
        luaModule.publishedInputSchema = luaModule.inputSchema;
        luaModule.publishedOutputSchema = luaModule.outputSchema;
        luaModule.isPublished = true;
        luaModule.publishedAt = new Date();
        return this.luaModuleRepository.save(luaModule);
    }

    async unpublish(id: string, userId: string): Promise<LuaModule> {
        const luaModule = await this.findOne(id, userId);
        if (!luaModule.isPublished) throw HttpErrorFactory.badRequest("该 Lua 模块当前未发布");
        luaModule.isPublished = false;
        return this.luaModuleRepository.save(luaModule);
    }

    async remove(id: string, userId: string): Promise<void> {
        const luaModule = await this.findOne(id, userId);
        await this.luaModuleRepository.remove(luaModule);
    }

    async executePublished(
        id: string,
        userId: string,
        params: Record<string, unknown>,
    ): Promise<LuaExecutionResult> {
        const luaModule = await this.findOne(id, userId);
        if (!luaModule.isPublished || !luaModule.publishedCode) {
            throw HttpErrorFactory.badRequest("Lua 模块尚未发布");
        }
        return this.luaRuntimeService.execute(luaModule.publishedCode, params);
    }

    private assertSchema(schema: Record<string, unknown>, label: string): void {
        if (schema.type !== "object") {
            throw HttpErrorFactory.badRequest(`${label}参数必须是 object 类型的 JSON Schema`);
        }
        const properties = schema.properties;
        if (
            properties !== undefined &&
            (!properties || typeof properties !== "object" || Array.isArray(properties))
        ) {
            throw HttpErrorFactory.badRequest(`${label}参数 properties 必须是对象`);
        }
    }
}
