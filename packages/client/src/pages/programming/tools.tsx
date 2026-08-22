import {
  programmingProjectToolKey,
  useAllXiaomiHomeDevicesQuery,
  useMcpServersAllQuery,
  useReplaceProgrammingProjectToolsMutation,
  useYeelightProDevicesQuery,
  type ProgrammingProjectToolRef,
  type XiaomiHomeDevice,
  type YeelightProDevice,
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
import { cn } from "@buildingai/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  AirVent,
  Blinds,
  Boxes,
  Check,
  ExternalLink,
  Fan,
  Home,
  Lightbulb,
  Plug,
  RefreshCw,
  Search,
  Server,
  Wrench,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useProgrammingProject } from "./context";

const DEVICE_ICONS: Record<string, LucideIcon> = {
  light: Lightbulb,
  switch: Plug,
  climate: AirVent,
  cover: Blinds,
  fan: Fan,
};

function asToolRef(tool: ProgrammingProjectToolRef): ProgrammingProjectToolRef {
  if (tool.kind === "xiaomi" || tool.kind === "yeelight") return tool;
  return { kind: "mcp", mcpServerId: tool.mcpServerId, toolName: tool.toolName };
}

type ListedDevice = {
  id: string;
  provider: "xiaomi" | "yeelight";
  name: string;
  category: string;
  categoryLabel: string;
  online: boolean;
  homeName: string | null;
  roomName: string | null;
  model: string | null;
};

function toListedXiaomi(device: XiaomiHomeDevice): ListedDevice {
  return {
    id: device.id,
    provider: "xiaomi",
    name: device.name,
    category: device.category,
    categoryLabel: device.categoryLabel,
    online: device.online,
    homeName: device.homeName,
    roomName: device.roomName,
    model: device.model,
  };
}

function toListedYeelight(device: YeelightProDevice): ListedDevice {
  return {
    id: device.id,
    provider: "yeelight",
    name: device.name,
    category: device.category,
    categoryLabel: device.categoryLabel,
    online: device.online,
    homeName: device.houseName,
    roomName: device.roomName,
    model: device.model,
  };
}

function deviceToolRef(device: ListedDevice): ProgrammingProjectToolRef {
  return { kind: device.provider, deviceId: device.id };
}

export default function ProgrammingToolsPage() {
  const project = useProgrammingProject();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword.trim().toLocaleLowerCase());
  const [selectedKeys, setSelectedKeys] = useState(
    () => new Set(project.tools.map((tool) => programmingProjectToolKey(asToolRef(tool)))),
  );
  const serversQuery = useMcpServersAllQuery({ isDisabled: false });
  const xiaomiQuery = useAllXiaomiHomeDevicesQuery();
  const yeelightQuery = useYeelightProDevicesQuery();

  useEffect(() => {
    setSelectedKeys(new Set(project.tools.map((tool) => programmingProjectToolKey(asToolRef(tool)))));
  }, [project.tools]);

  const devices = useMemo<ListedDevice[]>(() => {
    const list = [
      ...(xiaomiQuery.data ?? []).map(toListedXiaomi),
      ...(yeelightQuery.data ?? []).map(toListedYeelight),
    ];
    if (!deferredKeyword) return list;
    return list.filter((device) =>
      [device.name, device.categoryLabel, device.homeName, device.roomName, device.model, device.provider]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(deferredKeyword)),
    );
  }, [deferredKeyword, xiaomiQuery.data, yeelightQuery.data]);

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

  const enabledTools = useMemo(() => {
    const mcpTools = (serversQuery.data ?? []).flatMap((server) =>
      (server.tools ?? []).flatMap((tool) => {
        const reference: ProgrammingProjectToolRef = {
          kind: "mcp",
          mcpServerId: server.id,
          toolName: tool.name,
        };
        return selectedKeys.has(programmingProjectToolKey(reference)) ? [reference] : [];
      }),
    );
    const deviceTools = [
      ...(xiaomiQuery.data ?? []).map(toListedXiaomi),
      ...(yeelightQuery.data ?? []).map(toListedYeelight),
    ].flatMap((device) => {
      const reference = deviceToolRef(device);
      return selectedKeys.has(programmingProjectToolKey(reference)) ? [reference] : [];
    });
    return [...deviceTools, ...mcpTools];
  }, [selectedKeys, serversQuery.data, xiaomiQuery.data, yeelightQuery.data]);

  const savedKeys = useMemo(
    () => new Set(project.tools.map((tool) => programmingProjectToolKey(asToolRef(tool)))),
    [project.tools],
  );
  const hasChanges =
    selectedKeys.size !== savedKeys.size || [...selectedKeys].some((key) => !savedKeys.has(key));

  const toggleTool = (reference: ProgrammingProjectToolRef, checked: boolean) => {
    const key = programmingProjectToolKey(asToolRef(reference));
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const isLoading =
    (serversQuery.isLoading && serversQuery.data === undefined) ||
    (xiaomiQuery.isLoading && xiaomiQuery.data === undefined) ||
    (yeelightQuery.isLoading && yeelightQuery.data === undefined);
  const isError = serversQuery.isError && xiaomiQuery.isError && yeelightQuery.isError;
  const isEmpty = devices.length === 0 && servers.length === 0;
  const isFetching = serversQuery.isFetching || xiaomiQuery.isFetching || yeelightQuery.isFetching;

  const refetchAll = () => {
    void serversQuery.refetch();
    void xiaomiQuery.refetch();
    void yeelightQuery.refetch();
  };

  return (
    <div className="bg-muted/10 h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-6 md:px-8">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold">工程工具</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              已启用 {selectedKeys.size} 个工具，可在工作流的「工具」标签中拖入画布
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索设备、服务或工具"
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={refetchAll}
              disabled={isFetching}
              aria-label="刷新工具"
              title="刷新工具"
            >
              <RefreshCw className={isFetching ? "animate-spin" : undefined} />
            </Button>
            <Button
              onClick={() => saveMutation.mutate({ id: project.id, tools: enabledTools })}
              disabled={!hasChanges || saveMutation.isPending}
            >
              <Check /> 保存
            </Button>
          </div>
        </header>

        {isLoading ? (
          <div className="grid gap-3 pt-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <Empty className="mt-5 min-h-80 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Wrench />
              </EmptyMedia>
              <EmptyTitle>工具加载失败</EmptyTitle>
              <EmptyDescription>服务暂时不可用。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={refetchAll}>
                <RefreshCw /> 重试
              </Button>
            </EmptyContent>
          </Empty>
        ) : isEmpty ? (
          <Empty className="mt-5 min-h-80 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Server />
              </EmptyMedia>
              <EmptyTitle>{deferredKeyword ? "没有匹配的工具" : "暂无可用工具"}</EmptyTitle>
              <EmptyDescription>
                {deferredKeyword
                  ? "尝试调整搜索内容。"
                  : "先添加米家/易来设备，或在 MCP 服务中启用工具。"}
              </EmptyDescription>
            </EmptyHeader>
            {!deferredKeyword && (
              <EmptyContent>
                <Button variant="outline" onClick={() => navigate("/smart-home")}>
                  <Home /> 智能家居
                </Button>
                <Button variant="outline" onClick={() => navigate("/console/ai/mcp")}>
                  <ExternalLink /> MCP 服务
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="grid gap-3 pt-5">
            {devices.length > 0 ? (
              <section className="bg-background overflow-hidden rounded-md border">
                <div className="flex items-center gap-3 border-b px-4 py-3">
                  <span className="bg-muted flex size-8 items-center justify-center rounded-md">
                    <Home className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">物联网家具</h2>
                    <p className="text-muted-foreground truncate text-xs">
                      米家与易来设备可作为工作流工具直接拖入画布
                    </p>
                  </div>
                  <Badge variant="outline" className="font-normal">
                    {
                      devices.filter((device) =>
                        selectedKeys.has(programmingProjectToolKey(deviceToolRef(device))),
                      ).length
                    }
                    /{devices.length}
                  </Badge>
                </div>
                <div className="divide-y">
                  {devices.map((device) => {
                    const reference = deviceToolRef(device);
                    const checked = selectedKeys.has(programmingProjectToolKey(reference));
                    const checkboxId = `device-${device.provider}-${device.id}`;
                    const Icon = DEVICE_ICONS[device.category] || Boxes;
                    return (
                      <label
                        key={checkboxId}
                        htmlFor={checkboxId}
                        className="hover:bg-muted/40 flex cursor-pointer items-start gap-3 px-4 py-3"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          onCheckedChange={(value) => toggleTool(reference, value === true)}
                          className="mt-0.5"
                        />
                        <span className="bg-muted mt-0.5 flex size-8 items-center justify-center rounded-md">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{device.name}</span>
                          <span className="text-muted-foreground mt-0.5 block text-xs leading-4">
                            {[
                              device.provider === "yeelight" ? "易来" : "米家",
                              device.categoryLabel || device.category,
                              device.roomName || device.homeName,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "mt-1 size-1.5 shrink-0 rounded-full",
                            device.online ? "bg-emerald-500" : "bg-zinc-400",
                          )}
                          title={device.online ? "在线" : "离线"}
                        />
                      </label>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {servers.map((server) => {
              const selectedCount = server.tools.filter((tool) =>
                selectedKeys.has(
                  programmingProjectToolKey({
                    kind: "mcp",
                    mcpServerId: server.id,
                    toolName: tool.name,
                  }),
                ),
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
                      const reference: ProgrammingProjectToolRef = {
                        kind: "mcp",
                        mcpServerId: server.id,
                        toolName: tool.name,
                      };
                      const checked = selectedKeys.has(programmingProjectToolKey(reference));
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
