import { unstableSetCreateRoot } from "@flowgram.ai/form-materials";
import { createRoot } from "react-dom/client";

import { Editor } from "../workflows/editor";
import { initialData } from "../workflows/initial-data";
import type { FlowDocumentJSON } from "../workflows/typings";
import { normalizeWorkflowSchema } from "../workflows/utils/llm-schema";
import { useProgrammingProject } from "./context";

unstableSetCreateRoot(createRoot);

function resolveWorkflowSchema(schema: unknown): FlowDocumentJSON {
  if (
    schema &&
    typeof schema === "object" &&
    Array.isArray((schema as FlowDocumentJSON).nodes) &&
    Array.isArray((schema as FlowDocumentJSON).edges)
  ) {
    return normalizeWorkflowSchema(schema as FlowDocumentJSON);
  }
  return initialData;
}

export default function ProgrammingCanvasPage() {
  const project = useProgrammingProject();
  const workflow = project.mainWorkflow;

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <Editor
        key={workflow.id}
        projectId={project.id}
        workflowId={workflow.id}
        initialData={resolveWorkflowSchema(workflow.schema)}
      />
    </div>
  );
}
