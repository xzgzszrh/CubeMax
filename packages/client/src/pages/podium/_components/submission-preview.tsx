import { Badge } from "@buildingai/ui/components/ui/badge";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { FileQuestion } from "lucide-react";

type WorkflowSnapshot = {
  kind: "workflow";
  name: string;
  description: string;
  isPublished: boolean;
  schema: { nodes?: Array<{ id?: string; type?: string; data?: { title?: string } }> } | null;
};

type AgentSnapshot = {
  kind: "agent";
  name: string;
  description: string;
  rolePrompt: string;
  modelConfig: { id?: string; model?: string; [key: string]: unknown } | null;
  openingStatement: string;
};

type Snapshot = WorkflowSnapshot | AgentSnapshot;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * 提交成果的只读预览。
 *
 * 展示的是学生提交那一刻的快照，学生之后再改动不会影响这里，
 * 老师也不需要对学生的工作流/智能体拥有读取权限。
 */
export function SubmissionPreview({ snapshot }: { snapshot: Record<string, unknown> }) {
  const data = snapshot as unknown as Snapshot;

  if (!data?.kind) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center">
        <FileQuestion className="text-muted-foreground size-6" />
        <p className="text-muted-foreground text-sm">这条提交没有可预览的内容快照。</p>
      </div>
    );
  }

  if (data.kind === "workflow") {
    const nodes = data.schema?.nodes ?? [];
    return (
      <div className="grid gap-4">
        <Field label="工作流名称">
          <span className="flex items-center gap-2">
            {data.name}
            <Badge variant={data.isPublished ? "secondary" : "outline"}>
              {data.isPublished ? "已发布" : "草稿"}
            </Badge>
          </span>
        </Field>
        <Field label="描述">{data.description || "无"}</Field>
        <Field label={`节点（${nodes.length}）`}>
          {nodes.length ? (
            <ScrollArea className="max-h-64">
              <div className="divide-y border-y">
                {nodes.map((node, index) => (
                  <div className="flex items-center gap-2 px-2 py-1.5" key={node.id ?? index}>
                    <Badge variant="outline">{node.type || "unknown"}</Badge>
                    <span className="truncate text-sm">{node.data?.title || node.id || "—"}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <span className="text-muted-foreground">快照里没有节点信息。</span>
          )}
        </Field>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Field label="智能体名称">{data.name}</Field>
      <Field label="描述">{data.description || "无"}</Field>
      <Field label="模型">{data.modelConfig?.model || data.modelConfig?.id || "未设置"}</Field>
      <Field label="开场白">{data.openingStatement || "无"}</Field>
      <Field label="角色设定">
        {data.rolePrompt ? (
          <ScrollArea className="max-h-64">
            <pre className="bg-muted/40 p-3 text-xs whitespace-pre-wrap">{data.rolePrompt}</pre>
          </ScrollArea>
        ) : (
          <span className="text-muted-foreground">未设置</span>
        )}
      </Field>
    </div>
  );
}
