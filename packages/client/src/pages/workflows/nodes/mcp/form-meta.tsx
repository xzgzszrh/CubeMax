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

import { FormContent, FormHeader, FormInputs, FormItem } from "../../form-components";
import { useNodeRenderContext } from "../../hooks";
import type { JsonSchema } from "../../typings";
import {
  createEmptyMcpInputsSchema,
  createMcpInputsValues,
  createMcpToolInputsSchema,
} from "../../utils/mcp-schema";
import { defaultFormMeta } from "../default-form-meta";

function getServerLabel(server: McpServer): string {
  return server.alias || server.name;
}

function getToolLabel(tool: McpTool): string {
  return tool.description ? `${tool.name} - ${tool.description}` : tool.name;
}

function findTool(servers: McpServer[], serverId?: string, toolName?: string): McpTool | undefined {
  return servers
    .find((server) => server.id === serverId)
    ?.tools?.find((tool) => tool.name === toolName);
}

function McpConfig() {
  const { readonly } = useNodeRenderContext();
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
          const toolOptions =
            currentServer?.tools?.map((tool) => ({
              label: getToolLabel(tool),
              value: tool.name,
            })) ?? [];

          return (
            <Field<string | undefined> name="toolName">
              {({ field: toolField }) => (
                <Field<JsonSchema> name="inputs">
                  {({ field: inputsField }) => (
                    <Field<Record<string, IFlowValue>> name="inputsValues">
                      {({ field: inputsValuesField }) => (
                        <Field<Record<string, unknown>> name="toolInputSchema">
                          {({ field: toolInputSchemaField }) => (
                            <>
                              <FormItem name="MCP Server" required type="string">
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
                                  emptyContent={isLoading ? "Loading..." : "No MCP servers"}
                                  filter
                                  optionList={serverOptions}
                                  placeholder={isLoading ? "Loading..." : "Select MCP server"}
                                  showClear
                                  size="small"
                                  style={{ width: "100%" }}
                                />
                              </FormItem>

                              <FormItem name="Tool" required type="string">
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
                                      createMcpInputsValues(inputsSchema, inputsValuesField.value),
                                    );
                                  }}
                                  disabled={readonly || !serverField.value}
                                  emptyContent="No tools"
                                  filter
                                  optionList={toolOptions}
                                  placeholder="Select tool"
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
              )}
            </Field>
          );
        }}
      </Field>
    </>
  );
}

function McpOptions() {
  const { readonly } = useNodeRenderContext();

  return (
    <>
      <FormItem name="Timeout(ms)" required type="number">
        <Field<number> name="timeoutMs" defaultValue={60000}>
          {({ field }) => (
            <InputNumber
              disabled={readonly}
              min={1000}
              onChange={(value) => field.onChange(value as number)}
              size="small"
              style={{ width: "100%" }}
              value={field.value}
            />
          )}
        </Field>
      </FormItem>

      <FormItem name="Fail On Error" required type="boolean">
        <Field<boolean> name="failOnToolError" defaultValue>
          {({ field }) => (
            <Switch
              checked={field.value}
              disabled={readonly}
              onChange={(checked) => field.onChange(checked)}
              size="small"
            />
          )}
        </Field>
      </FormItem>
    </>
  );
}

export const renderForm = () => (
  <>
    <FormHeader />
    <FormContent>
      <McpConfig />
      <Divider />
      <FormInputs />
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
    mcpServerId: ({ value }: { value?: string }) => (value ? undefined : "MCP Server is required"),
    toolName: ({ value }: { value?: string }) => (value ? undefined : "Tool is required"),
  },
};
