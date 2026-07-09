import { getProvider, getReasoningOptions } from "@buildingai/ai-sdk";
import { SecretService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiModel } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { getProviderSecret } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";
import { generateText } from "ai";

export type WorkflowLlmExecutorInput = {
    userId?: string;
    node: {
        id: string;
        type: string;
        data?: Record<string, unknown>;
    };
    inputs: Record<string, unknown>;
};

type ParsedLlmInputs = {
    modelId?: string;
    modelName?: string;
    apiKey?: string;
    apiHost?: string;
    temperature: number;
    systemPrompt?: string;
    prompt: string;
};

@Injectable()
export class WorkflowLlmExecutorService {
    constructor(
        @InjectRepository(AiModel)
        private readonly aiModelRepository: Repository<AiModel>,
        private readonly secretService: SecretService,
    ) {}

    async execute(input: WorkflowLlmExecutorInput): Promise<Record<string, unknown>> {
        const parsedInputs = this.parseInputs(input.inputs);

        if (parsedInputs.modelId) {
            return this.executeConfiguredModel(parsedInputs);
        }

        return this.executeLegacyOpenAICompatibleModel(parsedInputs);
    }

    private async executeConfiguredModel(
        inputs: ParsedLlmInputs,
    ): Promise<Record<string, unknown>> {
        const model = await this.aiModelRepository.findOne({
            where: {
                id: inputs.modelId,
                isActive: true,
            },
            relations: ["provider"],
        });

        if (!model?.provider?.isActive) {
            throw new Error("LLM 节点选择的模型不存在或未启用");
        }

        if (!model.provider.bindSecretId) {
            throw new Error("LLM 节点选择的模型供应商未绑定密钥配置");
        }

        const providerSecret = await this.secretService.getConfigKeyValuePairs(
            model.provider.bindSecretId,
        );
        const providerId = model.provider.provider;
        const provider = getProvider(providerId, {
            apiKey: getProviderSecret("apiKey", providerSecret),
            baseURL: getProviderSecret("baseUrl", providerSecret) || undefined,
        });

        const result = await generateText({
            model: provider(model.model).model,
            prompt: inputs.prompt,
            system: inputs.systemPrompt,
            temperature: inputs.temperature,
            providerOptions: getReasoningOptions(providerId, { thinking: false }),
        });

        return { result: result.text };
    }

    private async executeLegacyOpenAICompatibleModel(
        inputs: ParsedLlmInputs,
    ): Promise<Record<string, unknown>> {
        const missingInputs: string[] = [];
        if (!inputs.modelName) missingInputs.push("modelName");
        if (!inputs.apiKey) missingInputs.push("apiKey");
        if (!inputs.apiHost) missingInputs.push("apiHost");

        if (missingInputs.length > 0) {
            throw new Error(`LLM node missing required inputs: "${missingInputs.join('", "')}"`);
        }

        const provider = getProvider("custom", {
            apiKey: inputs.apiKey,
            baseURL: inputs.apiHost,
        });

        const result = await generateText({
            model: provider(inputs.modelName!).model,
            prompt: inputs.prompt,
            system: inputs.systemPrompt,
            temperature: inputs.temperature,
        });

        return { result: result.text };
    }

    private parseInputs(inputs: Record<string, unknown>): ParsedLlmInputs {
        const modelId = this.optionalString(inputs.modelId);
        const modelName = this.optionalString(inputs.modelName);
        const apiKey = this.optionalString(inputs.apiKey);
        const apiHost = this.optionalString(inputs.apiHost);
        const systemPrompt = this.optionalString(inputs.systemPrompt);
        const prompt = this.requiredString(inputs.prompt, "prompt");
        const temperature = this.requiredNumber(inputs.temperature, "temperature");

        return {
            modelId,
            modelName,
            apiKey,
            apiHost,
            temperature,
            systemPrompt,
            prompt,
        };
    }

    private optionalString(value: unknown): string | undefined {
        if (typeof value !== "string") return undefined;
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    }

    private requiredString(value: unknown, fieldName: string): string {
        const parsedValue = this.optionalString(value);
        if (!parsedValue) {
            throw new Error(`LLM node missing required inputs: "${fieldName}"`);
        }
        return parsedValue;
    }

    private requiredNumber(value: unknown, fieldName: string): number {
        const numberValue =
            typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

        if (!Number.isFinite(numberValue)) {
            throw new Error(`LLM node missing required inputs: "${fieldName}"`);
        }

        return numberValue;
    }
}
