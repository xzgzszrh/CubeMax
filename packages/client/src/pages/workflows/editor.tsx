/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import "@flowgram.ai/free-layout-editor/index.css";
import "./styles/index.css";

import { EditorRenderer, FreeLayoutEditorProvider } from "@flowgram.ai/free-layout-editor";
import { DockedPanelLayer } from "@flowgram.ai/panel-manager-plugin";

import { WorkflowAutoSave } from "./components/workflow-auto-save";
import { WorkflowSaveProvider } from "./context";
import { useEditorProps } from "./hooks";
import { nodeRegistries } from "./nodes";
import type { FlowDocumentJSON } from "./typings";

export interface EditorProps {
  workflowId: string;
  initialData: FlowDocumentJSON;
  projectId?: string;
}

export const Editor = ({ workflowId, initialData, projectId }: EditorProps) => {
  const editorProps = useEditorProps(initialData, nodeRegistries, projectId);

  return (
    <div className="doc-free-feature-overview">
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
