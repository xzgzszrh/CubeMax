/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useAiProvidersQuery } from "@buildingai/services/web";
import { Select } from "@douyinfe/semi-ui";
import type { IFlowConstantValue, IFlowValue } from "@flowgram.ai/form-materials";
import { useMemo } from "react";

import { useNodeRenderContext } from "../../hooks";

interface LLMModelSelectProps {
  value?: IFlowValue;
  onChange: (value: IFlowConstantValue) => void;
}

function getSelectedModelId(value?: IFlowValue): string | undefined {
  if (value?.type !== "constant" || typeof value.content !== "string") {
    return undefined;
  }
  return value.content;
}

export function LLMModelSelect({ value, onChange }: LLMModelSelectProps) {
  const { readonly } = useNodeRenderContext();
  const { data: providers = [], isLoading } = useAiProvidersQuery({
    supportedModelTypes: "llm",
  });

  const optionList = useMemo(
    () =>
      providers.flatMap((provider) =>
        (provider.models ?? []).map((model) => ({
          label: model.model,
          value: model.id,
        })),
      ),
    [providers],
  );

  return (
    <Select
      value={getSelectedModelId(value)}
      onChange={(modelId) => {
        onChange({
          type: "constant",
          content: modelId,
        });
      }}
      disabled={readonly || isLoading}
      emptyContent={isLoading ? "模型加载中..." : "暂无可用模型"}
      filter
      optionList={optionList}
      placeholder={isLoading ? "模型加载中..." : "请选择模型"}
      showClear
      size="small"
      style={{ width: "100%" }}
    />
  );
}
