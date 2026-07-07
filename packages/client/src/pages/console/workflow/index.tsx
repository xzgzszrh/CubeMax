import { useDocumentHead } from "@buildingai/hooks";
import {
  type AiProvider,
  type AiProviderModel,
  useAiProvidersQuery,
} from "@buildingai/services/console";
import { PermissionGuard } from "@buildingai/ui/components/auth/permission-guard";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { StatusBadge } from "@buildingai/ui/components/ui/status-badge";
import { ExternalLink, PlusCircle, Workflow } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageContainer } from "@/layouts/console/_components/page-container";

import { WorkflowModelFormDialog } from "./_components/workflow-model-form-dialog";

type WorkflowModelItem = AiProviderModel & {
  provider: AiProvider;
};

function collectWorkflowModels(providers: AiProvider[]): WorkflowModelItem[] {
  return providers
    .flatMap((provider) =>
      (provider.models ?? [])
        .filter((model) => model.modelType === "llm")
        .map((model) => ({
          ...model,
          provider,
        })),
    )
    .sort(
      (a, b) =>
        Number(b.provider.isActive && b.isActive) - Number(a.provider.isActive && a.isActive) ||
        b.sortOrder - a.sortOrder ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

const WorkflowConfigPage = () => {
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const { data: providers = [], refetch, isLoading } = useAiProvidersQuery();

  useDocumentHead({
    title: "工作流配置",
  });

  const workflowModels = useMemo(() => collectWorkflowModels(providers), [providers]);
  const existingProviderCodes = useMemo(
    () => providers.map((provider) => provider.provider),
    [providers],
  );

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
              <Workflow className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold">工作流配置</h1>
              <p className="text-muted-foreground text-sm">管理工作流 LLM 节点可选择的后台模型</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/workflows">
                <ExternalLink />
                打开工作流
              </Link>
            </Button>
            <PermissionGuard
              permissions={["secret:create", "ai-providers:create", "ai-models:create"]}
            >
              <Button onClick={() => setModelDialogOpen(true)}>
                <PlusCircle />
                配置模型
              </Button>
            </PermissionGuard>
          </div>
        </div>

        <div className="bg-card rounded-lg border">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="text-sm font-medium">LLM 模型</h2>
              <p className="text-muted-foreground text-xs">
                这些模型会出现在工作流 LLM 节点的模型选择器中
              </p>
            </div>
            <Badge variant="secondary">{workflowModels.length}</Badge>
          </div>

          <div className="divide-y">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 p-4">
                  <Skeleton className="size-9 rounded-md" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))
            ) : workflowModels.length > 0 ? (
              workflowModels.map((model) => {
                const active = model.provider.isActive && model.isActive;
                return (
                  <div
                    key={model.id}
                    className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium break-all">{model.name}</span>
                        <Badge variant="outline">LLM</Badge>
                        <StatusBadge active={active} />
                      </div>
                      <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span className="break-all">模型 ID: {model.model}</span>
                        <span className="break-all">供应商: {model.provider.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:justify-end">
                      <Badge variant="secondary">
                        {model.billingRule?.power
                          ? `${model.billingRule.power} 积分 / 1K Tokens`
                          : "免费"}
                      </Badge>
                      <Button asChild size="xs" variant="outline">
                        <Link to="/console/provider">管理</Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
                暂无工作流可用模型
              </div>
            )}
          </div>
        </div>

        <WorkflowModelFormDialog
          open={modelDialogOpen}
          onOpenChange={setModelDialogOpen}
          existingProviderCodes={existingProviderCodes}
          onSuccess={refetch}
        />
      </div>
    </PageContainer>
  );
};

export default WorkflowConfigPage;
