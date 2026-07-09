/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { isNil } from "lodash-es";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { BaseMessageLike } from "@langchain/core/messages";
import { FlowGramNode } from "@flowgram.ai/runtime-interface";
import type {
    ExecutionContext,
    ExecutionResult,
    INodeExecutor,
} from "@flowgram.ai/runtime-interface";

export type LLMExecutorInput = {
    userId?: string;
    node: {
        id: string;
        type: string;
        data?: Record<string, unknown>;
    };
    inputs: Record<string, unknown>;
};

export type LLMExecutorHandler = (
    input: LLMExecutorInput,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

let workflowRuntimeLLMExecutor: LLMExecutorHandler | undefined;

export const registerLLMExecutor = (executor: LLMExecutorHandler): void => {
    workflowRuntimeLLMExecutor = executor;
};

export interface LLMExecutorInputs {
    modelId?: string;
    modelName: string;
    apiKey: string;
    apiHost: string;
    temperature: number;
    systemPrompt?: string;
    prompt: string;
}

export class LLMExecutor implements INodeExecutor {
    public readonly type = FlowGramNode.LLM;

    public async execute(context: ExecutionContext): Promise<ExecutionResult> {
        if (workflowRuntimeLLMExecutor) {
            const outputs = await workflowRuntimeLLMExecutor({
                userId: getWorkflowRuntimeUserId(context),
                node: {
                    id: context.node.id,
                    type: context.node.type,
                    data: isRecord(context.node.data) ? context.node.data : undefined,
                },
                inputs: context.inputs,
            });

            return {
                outputs: outputs ?? {},
            };
        }

        const inputs = context.inputs as LLMExecutorInputs;
        this.checkInputs(inputs);

        const { modelName, temperature, apiKey, apiHost, systemPrompt, prompt } = inputs;

        const model = new ChatOpenAI({
            modelName,
            temperature,
            apiKey,
            configuration: {
                baseURL: apiHost,
            },
            maxRetries: 3,
        });

        const messages: BaseMessageLike[] = [];

        if (systemPrompt) {
            messages.push(new SystemMessage(systemPrompt));
        }
        messages.push(new HumanMessage(prompt));

        let apiMessage;
        try {
            apiMessage = await model.invoke(messages);
        } catch (error) {
            // 调用 LLM API 失败
            const errorMessage = (error as Error)?.message;
            if (errorMessage === "Connection error.") {
                throw new Error(`Network error: unreachable api "${apiHost}"`);
            }
            throw error;
        }

        const result = apiMessage.content;
        return {
            outputs: {
                result,
            },
        };
    }

    protected checkInputs(inputs: LLMExecutorInputs) {
        const { modelName, temperature, apiKey, apiHost, prompt } = inputs;
        const missingInputs = [];

        if (!modelName) missingInputs.push("modelName");
        if (isNil(temperature)) missingInputs.push("temperature");
        if (!apiKey) missingInputs.push("apiKey");
        if (!apiHost) missingInputs.push("apiHost");
        if (!prompt) missingInputs.push("prompt");

        if (missingInputs.length > 0) {
            throw new Error(`LLM node missing required inputs: "${missingInputs.join('", "')}"`);
        }

        this.checkApiHost(apiHost);
    }

    private checkApiHost(apiHost: string): void {
        if (!apiHost || typeof apiHost !== "string") {
            throw new Error(`Invalid API host format - ${apiHost}`);
        }

        const url = new URL(apiHost);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error(`Invalid API host protocol - ${url.protocol}`);
        }
    }
}

function getWorkflowRuntimeUserId(context: ExecutionContext): string | undefined {
    const runtime = context.runtime as { metadata?: { userId?: unknown } };
    return typeof runtime.metadata?.userId === "string" ? runtime.metadata.userId : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
