import {
  type ProgrammingProjectToolRef,
  useMcpServersAllQuery,
  useReplaceProgrammingProjectToolsMutation,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@buildingai/ui/components/ui/empty";
import { Input } from "@buildingai/ui/components/ui/input";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { Check, ExternalLink, RefreshCw, Search, Server, Wrench } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useProgrammingProject } from "./context";

function toolKey(tool: ProgrammingProjectToolRef) {
  return `${tool.mcpServerId}\u0000${tool.toolName}`;
}

export default function ProgrammingToolsPage() {
  const project = useProgrammingProject();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword.trim().toLocaleLowerCase());
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(project.tools.map(toolKey)));
  const serversQuery = useMcpServersAllQuery({ isDisabled: false });

  useEffect(() => {
    setSelectedKeys(new Set(project.tools.map(toolKey)));
  }, [project.tools]);

  const servers = useMemo(
    () =>
      (serversQuery.data ?? []).flatMap((server) => {
        const tools = (server.tools ?? []).filter((tool) => {
          if (!deferredKeyword) return true;
          return [server.alias, server.name, tool.title, tool.name, tool.description]
            .filter(Boolean)
            .some((value) => value!.toLocaleLowerCase().includes(deferredKeyword));
        });
        return tools.length ? [{ ...server, tools }] : [];
      }),
    [deferredKeyword, serversQuery.data],
  );

  const saveMutation = useReplaceProgrammingProjectToolsMutation({
    onSuccess: () => toast.success("工具权限已保存"),
    onError: (error) => toast.error(error.message || "工具权限保存失败"),
  });

  const enabledTools = useMemo(
    () =>
      (serversQuery.data ?? []).flatMap((server) =>
        (server.tools ?? []).flatMap((tool) => {
          const reference = { mcpServerId: server.id, toolName: tool.name };
          return selectedKeys.has(toolKey(reference)) ? [reference] : [];
        }),
      ),
    [selectedKeys, serversQuery.data],
  );
  const savedKeys = useMemo(() => new Set(project.tools.map(toolKey)), [project.tools]);
  const hasChanges =
    selectedKeys.size !== savedKeys.size || [...selectedKeys].some((key) => !savedKeys.has(key));

  const toggleTool = (reference: ProgrammingProjectToolRef, checked: boolean) => {
    const key = toolKey(reference);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return (
    <div className="bg-muted/10 h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-6 md:px-8">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold">工程工具</h1>
            <p className="text-muted-foreground mt-1 text-sm">已启用 {selectedKeys.size} 个工具</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索服务或工具"
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => serversQuery.refetch()}
              disabled={serversQuery.isFetching}
              aria-label="刷新工具"
              title="刷新工具"
            >
              <RefreshCw className={serversQuery.isFetching ? "animate-spin" : undefined} />
            </Button>
            <Button
              onClick={() => saveMutation.mutate({ id: project.id, tools: enabledTools })}
              disabled={!hasChanges || saveMutation.isPending}
            >
              <Check /> 保存
            </Button>
          </div>
        </header>

        {serversQuery.isLoading ? (
          <div className="grid gap-3 pt-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-md" />
            ))}
          </div>
        ) : serversQuery.isError ? (
          <Empty className="mt-5 min-h-80 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Wrench />
              </EmptyMedia>
              <EmptyTitle>工具加载失败</EmptyTitle>
              <EmptyDescription>服务暂时不可用。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => serversQuery.refetch()}>
                <RefreshCw /> 重试
              </Button>
            </EmptyContent>
          </Empty>
        ) : servers.length === 0 ? (
          <Empty className="mt-5 min-h-80 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Server />
              </EmptyMedia>
              <EmptyTitle>{deferredKeyword ? "没有匹配的工具" : "暂无可用工具"}</EmptyTitle>
              <EmptyDescription>
                {deferredKeyword ? "尝试调整搜索内容。" : "先在 MCP 服务中添加并启用工具。"}
              </EmptyDescription>
            </EmptyHeader>
            {!deferredKeyword && (
              <EmptyContent>
                <Button variant="outline" onClick={() => navigate("/console/ai/mcp")}>
                  <ExternalLink /> MCP 服务
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="grid gap-3 pt-5">
            {servers.map((server) => {
              const selectedCount = server.tools.filter((tool) =>
                selectedKeys.has(toolKey({ mcpServerId: server.id, toolName: tool.name })),
              ).length;
              return (
                <section
                  key={server.id}
                  className="bg-background overflow-hidden rounded-md border"
                >
                  <div className="flex items-center gap-3 border-b px-4 py-3">
                    <span className="bg-muted flex size-8 items-center justify-center rounded-md">
                      <Server className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold">
                        {server.alias || server.name}
                      </h2>
                      <p className="text-muted-foreground truncate text-xs">
                        {server.description || server.url}
                      </p>
                    </div>
                    <Badge variant="outline" className="font-normal">
                      {selectedCount}/{server.tools.length}
                    </Badge>
                  </div>
                  <div className="divide-y">
                    {server.tools.map((tool) => {
                      const reference = { mcpServerId: server.id, toolName: tool.name };
                      const checked = selectedKeys.has(toolKey(reference));
                      const checkboxId = `tool-${server.id}-${tool.id}`;
                      return (
                        <label
                          key={tool.id}
                          htmlFor={checkboxId}
                          className="hover:bg-muted/40 flex cursor-pointer items-start gap-3 px-4 py-3"
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={checked}
                            onCheckedChange={(value) => toggleTool(reference, value === true)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">
                              {tool.title || tool.name}
                            </span>
                            <span className="text-muted-foreground mt-0.5 block text-xs leading-4">
                              {tool.description || tool.name}
                            </span>
                          </span>
                          <code className="text-muted-foreground hidden max-w-48 truncate text-[11px] sm:block">
                            {tool.name}
                          </code>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
