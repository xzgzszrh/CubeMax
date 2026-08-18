import { useDocumentHead } from "@buildingai/hooks";
import { useDeleteAgentMutation, useMyAgentsInfiniteQuery } from "@buildingai/services/web";
import { InfiniteScroll } from "@buildingai/ui/components/infinite-scroll";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@buildingai/ui/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@buildingai/ui/components/ui/input-group";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { cn } from "@buildingai/ui/lib/utils";
import { Bot, ChevronRight, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { PageShell } from "../_components/page-shell";
import { AgentModal } from "./_components/agent-modal";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "published" | "unpublished";

type AgentWorkspaceStatus = "pending" | "rejected" | "none" | "published" | "unpublished";

type AgentWorkspaceStatusSource = {
  publishedToSquare?: boolean | null;
  squarePublishStatus?: "none" | "pending" | "approved" | "rejected";
};

type AgentWorkspaceStatusConfig = {
  label: string;
  className?: string;
  variant:
    | "link"
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "destructive"
    | null
    | undefined;
};

const statusConfigMap: Record<AgentWorkspaceStatus, AgentWorkspaceStatusConfig> = {
  pending: {
    label: "待审核",
    variant: "secondary",
  },
  rejected: {
    label: "审核失败",
    variant: "destructive",
  },
  none: {
    label: "私有",
    variant: "outline",
  },
  published: {
    label: "已公开",
    variant: "secondary",
    className: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  unpublished: {
    label: "已下架",
    variant: "secondary",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
};

function getAgentWorkspaceStatus(agent: AgentWorkspaceStatusSource): AgentWorkspaceStatus {
  if (agent.squarePublishStatus === "approved") {
    return agent.publishedToSquare ? "published" : "unpublished";
  }

  return agent.squarePublishStatus ?? "none";
}

function getAgentWorkspaceStatusConfig(
  agent: AgentWorkspaceStatusSource,
): AgentWorkspaceStatusConfig {
  const status = getAgentWorkspaceStatus(agent);
  return statusConfigMap[status];
}

const AgentsWorkspacePage = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { confirm: alertConfirm } = useAlertDialog();

  useDocumentHead({
    title: "我的智能体",
  });

  const handleCreateSuccess = (agent: unknown) => {
    myAgentsQuery.refetch();
    const id = (agent as { id?: string } | null)?.id;
    if (id) navigate(`/agents/${id}/configuration`);
  };

  const myAgentsQuery = useMyAgentsInfiniteQuery(
    {
      pageSize: PAGE_SIZE,
      keyword: keyword.trim() || undefined,
      status,
    },
    { enabled: true },
  );

  const items = useMemo(
    () => myAgentsQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [myAgentsQuery.data?.pages],
  );
  const hasNextPage = myAgentsQuery.hasNextPage ?? false;
  const isFetchingNextPage = myAgentsQuery.isFetchingNextPage;

  const deleteAgentMutation = useDeleteAgentMutation();

  const handleDeleteAgent = async (agent: { id: string; name: string }) => {
    try {
      await alertConfirm({
        title: "删除确认",
        description: `确定要删除智能体"${agent.name}"吗？此操作不可恢复。`,
        confirmText: "删除",
        cancelText: "取消",
        confirmVariant: "destructive",
      });
    } catch {
      return;
    }

    try {
      await deleteAgentMutation.mutateAsync(agent.id);
      toast.success("删除成功");
      myAgentsQuery.refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      toast.error(message || "删除失败");
    }
  };

  const badgeClass = (selected: boolean) =>
    cn(
      "h-9 px-4 font-medium text-nowrap sm:font-normal cursor-pointer",
      selected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
    );

  return (
    <PageShell
      icon={Bot}
      eyebrow="智能体工作台"
      title="我的智能体"
      description="创建、配置并管理我的智能体应用"
      className="max-w-7xl"
      actions={
        <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="搜索智能体"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </InputGroup>
        </div>
      }
    >
      <div className="bg-background flex flex-col gap-3 rounded-lg border p-1.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1">
          <Badge className={badgeClass(status === "all")} onClick={() => setStatus("all")}>
            全部
          </Badge>
          <Badge
            className={badgeClass(status === "published")}
            onClick={() => setStatus("published")}
          >
            已公开
          </Badge>
          <Badge
            className={badgeClass(status === "unpublished")}
            onClick={() => setStatus("unpublished")}
          >
            私有
          </Badge>
        </div>
        <Button className="ml-auto rounded-md" onClick={() => setIsModalOpen(true)}>
          <Plus />
          创建智能体
        </Button>
      </div>

      <AgentModal
        mode="create"
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={handleCreateSuccess}
      />

      <div className="mt-5">
        {myAgentsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground size-8 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <Empty className="bg-background min-h-72 rounded-lg border-dashed shadow-xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bot />
              </EmptyMedia>
              <EmptyTitle>{keyword.trim() ? "没有匹配的智能体" : "暂无智能体"}</EmptyTitle>
              <EmptyDescription>
                {keyword.trim() ? "尝试调整搜索内容。" : "创建一个智能体后，它会显示在这里。"}
              </EmptyDescription>
            </EmptyHeader>
            {!keyword.trim() ? (
              <EmptyContent>
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus /> 创建智能体
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <InfiniteScroll
            loading={isFetchingNextPage}
            hasMore={hasNextPage}
            onLoadMore={() => myAgentsQuery.fetchNextPage()}
            emptyText=""
            showEmptyText={!hasNextPage}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((agent) => {
                const initial = agent.name.slice(0, 1).toUpperCase();
                const statusConfig = getAgentWorkspaceStatusConfig(agent);
                return (
                  <article
                    key={agent.id}
                    className="group bg-background hover:border-foreground/25 relative flex min-h-44 cursor-pointer flex-col rounded-lg border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/agents/${agent.id}/configuration`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/agents/${agent.id}/configuration`);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Avatar className="bg-muted size-11 rounded-lg after:rounded-lg">
                        <AvatarImage src={agent.avatar ?? undefined} className="rounded-lg" />
                        <AvatarFallback className="rounded-lg">{initial || <Bot />}</AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md"
                          aria-label="删除"
                          disabled={deleteAgentMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteAgent(agent);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="rounded-md"
                          aria-label="进入"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/agents/${agent.id}/configuration`);
                          }}
                        >
                          <ChevronRight />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">{agent.name}</h2>
                      {getAgentWorkspaceStatus(agent) !== "none" && (
                        <Badge variant={statusConfig.variant} className={statusConfig.className}>
                          {statusConfig.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                      {agent.description?.toString().trim() || "暂无描述"}
                    </p>
                    <div className="text-muted-foreground mt-auto pt-4 text-[11px]">
                      {getAgentWorkspaceStatus(agent) === "published" ? "已公开展示" : "仅自己可见"}
                    </div>
                  </article>
                );
              })}
            </div>
          </InfiniteScroll>
        )}
      </div>
    </PageShell>
  );
};

export default AgentsWorkspacePage;
