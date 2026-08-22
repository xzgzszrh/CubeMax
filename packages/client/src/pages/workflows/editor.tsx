/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import "@flowgram.ai/free-layout-editor/index.css";
import "./styles/index.css";

import type { ProgrammingProjectType } from "@buildingai/services/web";
import { EditorRenderer, FreeLayoutEditorProvider } from "@flowgram.ai/free-layout-editor";
import { DockedPanelLayer } from "@flowgram.ai/panel-manager-plugin";
import { useMemo } from "react";

import { WorkflowAutoSave } from "./components/workflow-auto-save";
import { WorkflowSaveProvider } from "./context";
import { useUserLuaNodes } from "./context/UserLuaNodesContext";
import { useEditorProps } from "./hooks";
import { nodeRegistries } from "./nodes";
import type { FlowDocumentJSON } from "./typings";

export interface EditorProps {
  workflowId: string;
  initialData: FlowDocumentJSON;
  projectId?: string;
  projectType?: ProgrammingProjectType;
}

export const Editor = ({
  workflowId,
  initialData,
  projectId,
  projectType = "conversation",
}: EditorProps) => {
  const { registries: userLuaRegistries } = useUserLuaNodes();
  const registries = useMemo(
    () =>
      projectType === "application"
        ? [...nodeRegistries, ...userLuaRegistries]
        : nodeRegistries,
    [projectType, userLuaRegistries],
  );
  const editorProps = useEditorProps(initialData, registries, projectId, projectType);

  return (
    <div className="doc-free-feature-overview" data-workflow-type={projectType}>
      <WorkflowSaveProvider workflowId={workflowId} projectId={projectId}>
        <FreeLayoutEditorProvider {...editorProps}>
          <WorkflowAutoSave />
          <div className="demo-container">
            <DockedPanelLayer>
              <EditorRenderer className="demo-editor" />
            </DockedPanelLayer>
          </div>
        </FreeLayoutEditorProvider>
      </WorkflowSaveProvider>
    </div>
  );
};
