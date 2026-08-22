/**
 * 用户 Lua 节点的表单元数据。
 * 复用 FormInputs / DisplayOutputs；模块身份存在 luaModuleId 里，不在界面展示。
 */

import { Divider } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";

import { FormContent, FormHeader, FormInputs } from "../../form-components";
import { defaultFormMeta } from "../default-form-meta";

export const renderForm = () => (
  <>
    <FormHeader />
    <FormContent>
      <FormInputs />
      <Divider />
      <DisplayOutputs displayFromScope />
    </FormContent>
  </>
);

export const userLuaFormMeta = {
  ...defaultFormMeta,
  render: renderForm,
} satisfies typeof defaultFormMeta;
