import { useLuaModulesQuery } from "@buildingai/services/web";
import { Divider, Select } from "@douyinfe/semi-ui";
import { DisplayOutputs, type IFlowValue } from "@flowgram.ai/form-materials";
import { Field, type FormMeta } from "@flowgram.ai/free-layout-editor";

import {
  FormContent,
  FormHeader,
  FormInputs,
  FormItem,
  ReadonlyValue,
} from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { JsonSchema } from "../../typings";
import { defaultFormMeta } from "../default-form-meta";

function createInputValues(schema: JsonSchema): Record<string, IFlowValue> {
  return Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, property]) => [
      key,
      { type: "constant", content: property.default ?? "" } as IFlowValue,
    ]),
  );
}

function LuaModuleSelect() {
  const isSidebar = useIsSidebar();
  const { readonly } = useNodeRenderContext();
  const { data, isLoading } = useLuaModulesQuery({ isPublished: true });
  const modules = data?.items ?? [];

  return (
    <Field<string> name="luaModuleId">
      {({ field }) => {
        const selected = modules.find((item) => item.id === field.value);
        if (!isSidebar) {
          return (
            <FormItem name="Lua 模块" required type="string">
              <ReadonlyValue value={selected?.name ?? field.value} />
            </FormItem>
          );
        }
        return (
          <Field<JsonSchema> name="inputs">
            {({ field: inputsField }) => (
              <Field<Record<string, IFlowValue>> name="inputsValues">
                {({ field: valuesField }) => (
                  <Field<JsonSchema> name="outputs">
                    {({ field: outputsField }) => (
                      <FormItem name="Lua 模块" required type="string">
                        <Select
                          value={field.value}
                          disabled={readonly || isLoading}
                          placeholder={isLoading ? "加载中..." : "选择已发布模块"}
                          emptyContent="暂无已发布模块"
                          optionList={modules.map((item) => ({ label: item.name, value: item.id }))}
                          onChange={(value) => {
                            const next = modules.find((item) => item.id === value);
                            field.onChange(value as string);
                            if (!next) return;
                            const inputs = (next.publishedInputSchema ??
                              next.inputSchema) as JsonSchema;
                            const outputs = (next.publishedOutputSchema ??
                              next.outputSchema) as JsonSchema;
                            inputsField.onChange(inputs);
                            valuesField.onChange(createInputValues(inputs));
                            outputsField.onChange(outputs);
                          }}
                          filter
                          size="small"
                          style={{ width: "100%" }}
                        />
                      </FormItem>
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
}

export const formMeta: FormMeta = {
  render: () => (
    <>
      <FormHeader />
      <FormContent>
        <LuaModuleSelect />
        <FormInputs />
        <Divider />
        <Field<JsonSchema> name="outputs">
          {({ field }) => <DisplayOutputs value={field.value} />}
        </Field>
      </FormContent>
    </>
  ),
  validate: {
    ...defaultFormMeta.validate,
    luaModuleId: ({ value }) => (value ? undefined : "请选择 Lua 模块"),
  },
  effect: defaultFormMeta.effect,
};
