/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import React from "react";

import { useOptionalProgrammingProject } from "../../../programming/context";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { FlowNodeRegistry } from "../../typings";
import { NodeGuidance } from "./node-guidance";
import { FormWrapper } from "./styles";

/**
 * @param props
 * @constructor
 */
export function FormContent(props: { children?: React.ReactNode }) {
  const { node, expanded } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  const project = useOptionalProgrammingProject();
  const registry = node.getNodeRegistry<FlowNodeRegistry>();
  return (
    <FormWrapper>
      <>
        {isSidebar && project?.projectType === "application" && (
          <NodeGuidance node={node} registry={registry} />
        )}
        {(expanded || isSidebar) && props.children}
      </>
    </FormWrapper>
  );
}
