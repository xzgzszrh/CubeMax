/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { createInferAssignPlugin, DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";

import { FlowAssignRows, FormContent, FormHeader } from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import { defaultFormMeta } from "../default-form-meta";

export const FormRender = () => {
  const isSidebar = useIsSidebar();
  const { readonly } = useNodeRenderContext();

  return (
    <>
      <FormHeader />
      <FormContent>
        {isSidebar ? (
          <FlowAssignRows name="assign" readonly={readonly} />
        ) : (
          <DisplayOutputs displayFromScope />
        )}
      </FormContent>
    </>
  );
};

export const formMeta: FormMeta = {
  render: (props) => <FormRender {...props} />,
  effect: defaultFormMeta.effect,
  plugins: [
    createInferAssignPlugin({
      assignKey: "assign",
      outputKey: "outputs",
    }),
  ],
};
