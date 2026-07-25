/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { McpServer, McpTool } from "@buildingai/services/web";
import { useMcpServersAllQuery } from "@buildingai/services/web";
import { Divider, InputNumber, Select, Switch } from "@douyinfe/semi-ui";
import type { IFlowValue } from "@flowgram.ai/form-materials";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";
import { useMemo } from "react";

import {
  FormContent,
  FormHeader,
  FormInputs,
  FormItem,
  ReadonlyValue,
} from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { JsonSchema } from "../../typings";
import {
  createEmptyMcpInputsSchema,
  createMcpInputsValues,
  createMcpToolInputsSchema,
} from "../../utils/mcp-schema";
import { defaultFormMeta } from "../default-form-meta";
import { resolveMcpToolInputUi } from "./tool-input-ui/registry";
import { McpToolValueInput } from "./tool-input-ui/tool-value-input";

function getServerLabel(server: McpServer): string {
  return server.alias || server.name;
}

function getToolLabel(tool: McpTool): string {
  const name = tool.title || tool.name;
  return tool.description ? `${name} - ${tool.description}` : name;
}

function findTool(servers: McpServer[], serverId?: string, toolName?: string): McpTool | undefined {
  return servers
    .find((server) => server.id === serverId)
    ?.tools?.find((tool) => tool.name === toolName);
}

function McpConfig() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  const { data: servers = [], isLoading } = useMcpServersAllQuery({ isDisabled: false });

  const serverOptions = useMemo(
    () =>
      servers.map((server) => ({
        label: getServerLabel(server),
        value: server.id,
      })),
    [servers],
  );

  return (
    <>
      <Field<string | undefined> name="mcpServerId">
        {({ field: serverField }) => {
          const currentServer = servers.find((server) => server.id === serverField.value);
          const serverDisplay = isLoading
            ? "加载中..."
            : currentServer
              ? getServerLabel(currentServer)
              : serverField.value;
          const toolOptions =
            currentServer?.tools?.map((tool) => ({
              label: getToolLabel(tool),
              value: tool.name,
            })) ?? [];

          return (
            <Field<string | undefined> name="toolName">
              {({ field: toolField }) => {
                const selectedTool = currentServer?.tools?.find(
                  (tool) => tool.name === toolField.value,
                );
                const toolDisplay = selectedTool ? getToolLabel(selectedTool) : toolField.value;

                if (!isSidebar) {
                  return (
                    <>
                      <FormItem name="MCP 服务" required type="string">
                        <ReadonlyValue value={serverDisplay} />
                      </FormItem>
                      <FormItem name="工具" required type="string">
                        <ReadonlyValue value={toolDisplay} />
                      </FormItem>
                    </>
                  );
                }

                return (
                  <Field<JsonSchema> name="inputs">
                    {({ field: inputsField }) => (
                      <Field<Record<string, IFlowValue>> name="inputsValues">
                        {({ field: inputsValuesField }) => (
                          <Field<Record<string, unknown>> name="toolInputSchema">
                            {({ field: toolInputSchemaField }) => (
                              <>
                                <FormItem name="MCP 服务" required type="string">
                                  <Select
                                    value={serverField.value}
                                    onChange={(value) => {
                                      serverField.onChange(value as string);
                                      toolField.onChange(undefined);
                                      toolInputSchemaField.onChange({});
                                      inputsField.onChange(createEmptyMcpInputsSchema());
                                      inputsValuesField.onChange({});
                                    }}
                                    disabled={readonly || isLoading}
                                    emptyContent={isLoading ? "加载中..." : "暂无 MCP 服务"}
                                    filter
                                    optionList={serverOptions}
                                    placeholder={isLoading ? "加载中..." : "选择 MCP 服务"}
                                    showClear
                                    size="small"
                                    style={{ width: "100%" }}
                                  />
                                </FormItem>

                                <FormItem name="工具" required type="string">
                                  <Select
                                    value={toolField.value}
                                    onChange={(value) => {
                                      const toolName = value as string;
                                      const tool = findTool(servers, serverField.value, toolName);
                                      const inputSchema = tool?.inputSchema ?? {};
                                      const inputsSchema = createMcpToolInputsSchema(inputSchema);

                                      toolField.onChange(toolName);
                                      toolInputSchemaField.onChange(inputSchema);
                                      inputsField.onChange(inputsSchema);
                                      inputsValuesField.onChange(
                                        createMcpInputsValues(
                                          inputsSchema,
                                          inputsValuesField.value,
                                        ),
                                      );
                                    }}
                                    disabled={readonly || !serverField.value}
                                    emptyContent="暂无工具"
                                    filter
                                    optionList={toolOptions}
                                    placeholder="选择工具"
                                    showClear
                                    size="small"
                                    style={{ width: "100%" }}
                                  />
                                </FormItem>
                              </>
                            )}
                          </Field>
                        )}
                      </Field>
                    )}
                  </Field>
                );
              }}
            </Field>
          );
        }}
      </Field>
    </>
  );
}

function McpOptions() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <>
      <FormItem name="超时(ms)" required type="number">
        <Field<number> name="timeoutMs" defaultValue={60000}>
          {({ field }) =>
            isSidebar ? (
              <InputNumber
                disabled={readonly}
                min={1000}
                onChange={(value) => field.onChange(value as number)}
                size="small"
                style={{ width: "100%" }}
                value={field.value}
              />
            ) : (
              <ReadonlyValue value={field.value} />
            )
          }
        </Field>
      </FormItem>

      <FormItem name="出错时失败" required type="boolean">
        <Field<boolean> name="failOnToolError" defaultValue>
          {({ field }) =>
            isSidebar ? (
              <Switch
                checked={field.value}
                disabled={readonly}
                onChange={(checked) => field.onChange(checked)}
                size="small"
              />
            ) : (
              <ReadonlyValue value={field.value} />
            )
          }
        </Field>
      </FormItem>
    </>
  );
}

function McpInputs() {
  const { data: servers = [] } = useMcpServersAllQuery({ isDisabled: false });

  return (
    <Field<string | undefined> name="mcpServerId">
      {({ field: serverField }) => (
        <Field<string | undefined> name="toolName">
          {({ field: toolField }) => {
            const serverKey = servers.find((server) => server.id === serverField.value)?.key;

            return (
              <FormInputs
                renderInput={({ inputName, schema, value, onChange, readonly, hasError }) => {
                  const inputUi = resolveMcpToolInputUi({
                    serverKey,
                    toolName: toolField.value,
                    inputName,
                    schema,
                  });

                  if (!inputUi) return undefined;

                  return (
                    <McpToolValueInput
                      inputUi={inputUi}
                      value={value}
                      onChange={onChange}
                      schema={schema}
                      readonly={readonly}
                      hasError={hasError}
                    />
                  );
                }}
              />
            );
          }}
        </Field>
      )}
    </Field>
  );
}

export const renderForm = () => (
  <>
    <FormHeader />
    <FormContent>
      <McpConfig />
      <Divider />
      <McpInputs />
      <Divider />
      <McpOptions />
      <Divider />
      <DisplayOutputs displayFromScope />
    </FormContent>
  </>
);

export const formMeta: FormMeta = {
  ...defaultFormMeta,
  render: renderForm,
  validate: {
    ...defaultFormMeta.validate,
    mcpServerId: ({ value }: { value?: string }) => (value ? undefined : "MCP 服务为必填项"),
    toolName: ({ value }: { value?: string }) => (value ? undefined : "工具为必填项"),
  },
};
