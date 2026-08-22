import { getProvider, getReasoningOptions } from "@buildingai/ai-sdk";
import { SecretService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiModel } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { getProviderSecret } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";
import { generateText, Output } from "ai";
import { z } from "zod";

import { DEVICE_SYSTEM_PROMPT } from "./lua-code-assistant.prompts";
import type { GenerateLuaModuleDto } from "./lua-module.dto";

const jsonObjectSchema = z.record(z.string(), z.unknown());

const generatedModuleSchema = z.object({
    reply: z.string().describe("面向学生的简短中文回复，说明本轮完成了什么"),
    name: z.string().min(1).max(100).describe("模块名称"),
    description: z.string().max(500).describe("模块用途说明"),
    draftCode: z.string().min(1).max(65536).describe("完整可执行的 Lua 5.4 代码"),
    inputSchema: jsonObjectSchema.describe("完整的输入 JSON Schema，根类型必须是 object"),
    outputSchema: jsonObjectSchema.describe("完整的输出 JSON Schema，根类型必须是 object"),
    testParams: jsonObjectSchema.describe("一组与输入 Schema 匹配的测试参数"),
});

export type GeneratedLuaModule = z.infer<typeof generatedModuleSchema>;

@Injectable()
export class LuaCodeAssistantService {
    constructor(
        @InjectRepository(AiModel)
        private readonly aiModelRepository: Repository<AiModel>,
        private readonly secretService: SecretService,
    ) {}

    async generate(dto: GenerateLuaModuleDto): Promise<GeneratedLuaModule> {
        const model = await this.aiModelRepository.findOne({
            where: { id: dto.modelId, isActive: true, modelType: "llm" },
            relations: ["provider"],
        });

        if (!model?.provider?.isActive) {
            throw HttpErrorFactory.badRequest("选择的 LLM 模型不存在或未启用");
        }
        if (!model.provider.bindSecretId) {
            throw HttpErrorFactory.badRequest("选择的模型供应商尚未配置密钥");
        }

        const secret = await this.secretService.getConfigKeyValuePairs(model.provider.bindSecretId);
        const providerId = model.provider.provider;
        const provider = getProvider(providerId, {
            apiKey: getProviderSecret("apiKey", secret),
            baseURL: getProviderSecret("baseUrl", secret) || undefined,
        });

        const current = this.normalizeCurrent(dto.current);
        const history = (dto.messages ?? []).map(({ role, content }) => ({ role, content }));
        const result = await generateText({
            model: provider(model.model).model,
            output: Output.object({ schema: generatedModuleSchema }),
            system: DEVICE_SYSTEM_PROMPT,
            prompt: `目标运行环境：真实 CubeCat 设备（Claw4 Lua 运行时）。只生成能在 CubeCat 上执行的代码，不要写网页仿真器程序。\n最近对话：\n${JSON.stringify(history)}\n\n当前模块：\n${JSON.stringify(current)}\n\n学生本轮要求：\n${dto.message.trim()}`,
            temperature: 0.2,
            providerOptions: getReasoningOptions(providerId, { thinking: false }),
        });

        if (!result.output) {
            throw HttpErrorFactory.internal("模型没有返回可用的 Lua 模块");
        }
        this.assertGeneratedModule(result.output);
        return result.output;
    }

    private normalizeCurrent(current: GenerateLuaModuleDto["current"]) {
        return {
            name: this.stringValue(current.name, 100),
            description: this.stringValue(current.description, 500),
            draftCode: this.stringValue(current.draftCode, 65536),
            inputSchema: this.objectValue(current.inputSchema),
            outputSchema: this.objectValue(current.outputSchema),
            testParams: this.objectValue(current.testParams),
        };
    }

    private stringValue(value: unknown, maxLength: number): string {
        return typeof value === "string" ? value.slice(0, maxLength) : "";
    }

    private objectValue(value: unknown): Record<string, unknown> {
        return value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
    }

    private assertGeneratedModule(module: GeneratedLuaModule): void {
        if (!/function\s+main\s*\(/.test(module.draftCode)) {
            throw HttpErrorFactory.badRequest("模型生成的代码缺少 main(params) 函数，请重试");
        }
        if (module.inputSchema.type !== "object" || module.outputSchema.type !== "object") {
            throw HttpErrorFactory.badRequest("模型生成的输入输出定义格式不正确，请重试");
        }
    }
}
