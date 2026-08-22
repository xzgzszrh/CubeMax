import { unstableSetCreateRoot } from "@flowgram.ai/form-materials";
import { createRoot } from "react-dom/client";

import { Editor } from "../workflows/editor";
import { applicationInitialData, initialData } from "../workflows/initial-data";
import type { FlowDocumentJSON } from "../workflows/typings";
import { normalizeWorkflowSchema } from "../workflows/utils/llm-schema";
import { ensureTerminalNodes } from "../workflows/utils/terminal-nodes";
import { useProgrammingProject } from "./context";

unstableSetCreateRoot(createRoot);

function resolveWorkflowSchema(schema: unknown, fallback: FlowDocumentJSON): FlowDocumentJSON {
  if (
    schema &&
    typeof schema === "object" &&
    Array.isArray((schema as FlowDocumentJSON).nodes) &&
    Array.isArray((schema as FlowDocumentJSON).edges)
  ) {
    return normalizeWorkflowSchema(ensureTerminalNodes(schema as FlowDocumentJSON, fallback));
  }
  return fallback;
}

export default function ProgrammingCanvasPage() {
  const project = useProgrammingProject();
  const workflow = project.mainWorkflow;

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <Editor
        key={workflow.id}
        projectId={project.id}
        projectType={project.projectType}
        workflowId={workflow.id}
        initialData={resolveWorkflowSchema(
          workflow.schema,
          project.projectType === "application" ? applicationInitialData : initialData,
        )}
      />
    </div>
  );
}
