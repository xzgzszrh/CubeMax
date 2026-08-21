/**
 * 用户 Lua 节点的表单元数据。
 * 复用 FormInputs / DisplayOutputs，只渲染标题和模块信息。
 */

import { Divider } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import { Field } from "@flowgram.ai/free-layout-editor";

import {
  FormContent,
  FormHeader,
  FormInputs,
  FormItem,
  ReadonlyValue,
} from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import { defaultFormMeta } from "../default-form-meta";

export const renderForm = () => (
  <>
    <FormHeader />
    <FormContent>
      <ModuleInfo />
      <Divider />
      <FormInputs />
      <Divider />
      <DisplayOutputs displayFromScope />
    </FormContent>
  </>
);

function ModuleInfo() {
  const isSidebar = useIsSidebar();
  return (
    <Field<string> name="luaModuleId">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="Lua 模块" required type="string">
            <ReadonlyValue value={field.value} />
          </FormItem>
        ) : (
          <FormItem name="Lua 模块" type="string">
            <ReadonlyValue value={field.value ?? "—"} />
          </FormItem>
        )
      }
    </Field>
  );
}

export const userLuaFormMeta = {
  ...defaultFormMeta,
  render: renderForm,
} satisfies typeof defaultFormMeta;
