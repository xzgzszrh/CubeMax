import {
  type ProgrammingTriggerItem,
  useDeleteProgrammingTriggerMutation,
  useProgrammingTriggersQuery,
  useUpdateProgrammingTriggerMutation,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@buildingai/ui/components/ui/dropdown-menu";
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
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import {
  CheckCircle2,
  CircleSlash2,
  Ellipsis,
  FormInput,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { PageShell } from "../_components/page-shell";
import { TriggerEditorDialog } from "./trigger-editor-dialog";
import { TriggerRunDialog } from "./trigger-run-dialog";

const PAGE_SIZE = 100;

type TriggerFilter = "all" | "enabled" | "pinned";

const RUNTIME_LABELS: Record<string, string> = {
  local: "本地运行",
  simulator: "硬件仿真",
  device: "CubeCat 设备",
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚更新";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFieldCount(trigger: ProgrammingTriggerItem) {
  return Object.keys(trigger.inputSchema.properties ?? {}).length;
}

export default function TriggersPage() {
  const { confirm } = useAlertDialog();
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword.trim());
  const [filter, setFilter] = useState<TriggerFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<ProgrammingTriggerItem | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [runningTrigger, setRunningTrigger] = useState<ProgrammingTriggerItem | null>(null);

  const triggersQuery = useProgrammingTriggersQuery({
    page: 1,
    pageSize: PAGE_SIZE,
    keyword: deferredKeyword || undefined,
    isEnabled: filter === "enabled" ? true : undefined,
    isPinned: filter === "pinned" ? true : undefined,
  });
  const triggers = triggersQuery.data?.items ?? [];

  const updateMutation = useUpdateProgrammingTriggerMutation({
    onSuccess: (trigger) => toast.success(trigger.isEnabled ? "触发器已启用" : "触发器已停用"),
    onError: (error) => toast.error(error.message || "触发器状态更新失败"),
  });
  const deleteMutation = useDeleteProgrammingTriggerMutation({
    onSuccess: () => toast.success("触发器已删除"),
    onError: (error) => toast.error(error.message || "触发器删除失败"),
  });

  const openEditor = (trigger?: ProgrammingTriggerItem) => {
    setEditingTrigger(trigger ?? null);
    setEditorOpen(true);
  };

  const openRunner = (trigger: ProgrammingTriggerItem) => {
    setRunningTrigger(trigger);
    setRunOpen(true);
  };

  const handleDelete = async (trigger: ProgrammingTriggerItem) => {
    try {
      await confirm({
        title: "删除触发器？",
        description: `删除「${trigger.name}」后，首页快捷入口和表单设置都会移除。此操作不可撤销。`,
        confirmText: "删除触发器",
        cancelText: "取消",
        confirmVariant: "destructive",
      });
      await deleteMutation.mutateAsync(trigger.id);
    } catch (error) {
      if (error instanceof Error && error.message === "AlertDialog cancelled") return;
    }
  };

  const handleToggle = (trigger: ProgrammingTriggerItem) => {
    updateMutation.mutate({ id: trigger.id, dto: { isEnabled: !trigger.isEnabled } });
  };

  return (
    <PageShell
      icon={Zap}
      title={
        <span className="flex items-center gap-3">
          触发器
          <Badge variant="outline" className="font-normal">
            表单触发
          </Badge>
        </span>
      }
      description="用一个表单入口运行已发布的编程工程"
      actions={
        <>
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索触发器"
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void triggersQuery.refetch()}
            disabled={triggersQuery.isFetching}
            aria-label="刷新触发器"
            title="刷新触发器"
          >
            <RefreshCw className={triggersQuery.isFetching ? "animate-spin" : undefined} />
          </Button>
          <Button type="button" onClick={() => openEditor()}>
            <Plus /> 新建触发器
          </Button>
        </>
      }
    >
      <div className="bg-background flex flex-wrap items-center gap-1 rounded-lg border p-1.5 shadow-xs">
        {(
          [
            ["all", "全部"],
            ["enabled", "已启用"],
            ["pinned", "首页快捷"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={filter === value ? "secondary" : "ghost"}
            size="sm"
            className="rounded-md"
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
        <span className="text-muted-foreground ml-auto px-2 text-xs tabular-nums">
          {triggersQuery.data?.total ?? 0} 个触发器
        </span>
      </div>

      <main className="pt-5">
        {triggersQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="bg-background flex min-h-44 flex-col rounded-lg border p-4 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <Skeleton className="size-10 rounded-lg" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
                <Skeleton className="mt-5 h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
                <Skeleton className="mt-auto h-3 w-3/5" />
              </div>
            ))}
          </div>
        ) : triggersQuery.isError ? (
          <Empty className="bg-background min-h-72 rounded-lg border-dashed shadow-xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Zap />
              </EmptyMedia>
              <EmptyTitle>触发器加载失败</EmptyTitle>
              <EmptyDescription>服务暂时不可用，请稍后重试。</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => void triggersQuery.refetch()}>
                <RefreshCw /> 重试
              </Button>
            </EmptyContent>
          </Empty>
        ) : triggers.length === 0 ? (
          <Empty className="bg-background min-h-72 rounded-lg border-dashed shadow-xs">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FormInput />
              </EmptyMedia>
              <EmptyTitle>{deferredKeyword ? "没有匹配的触发器" : "暂无触发器"}</EmptyTitle>
              <EmptyDescription>
                {deferredKeyword
                  ? "尝试调整搜索内容。"
                  : "创建一个表单触发器，让工程可以被快速执行。"}
              </EmptyDescription>
            </EmptyHeader>
            {!deferredKeyword && (
              <EmptyContent>
                <Button onClick={() => openEditor()}>
                  <Plus /> 新建触发器
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {triggers.map((trigger) => (
              <article
                key={trigger.id}
                className="group bg-background hover:border-foreground/25 relative flex min-h-44 cursor-pointer flex-col rounded-lg border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                role="button"
                tabIndex={0}
                onClick={() => openRunner(trigger)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openRunner(trigger);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <Zap className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2 pr-8">
                      <h2 className="truncate text-sm font-semibold">{trigger.name}</h2>
                      {trigger.isPinned ? (
                        <Badge variant="secondary" className="shrink-0 font-normal">
                          首页快捷
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-1 line-clamp-2 min-h-8 text-xs leading-4">
                      {trigger.description?.trim() || "运行绑定工程的主流程"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-3 right-3 z-10"
                        aria-label={`${trigger.name} 的更多操作`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenuItem onClick={() => openRunner(trigger)}>
                        <Play /> 执行触发器
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditor(trigger)}>
                        <Pencil /> 编辑设置
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(trigger)}>
                        {trigger.isEnabled ? <CircleSlash2 /> : <CheckCircle2 />}
                        {trigger.isEnabled ? "停用触发器" : "启用触发器"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => void handleDelete(trigger)}
                      >
                        <Trash2 /> 删除触发器
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 text-xs">
                  <span className="text-foreground/80 inline-flex items-center gap-1.5">
                    <Sparkles className="text-muted-foreground size-3.5" />
                    {trigger.project.name}
                  </span>
                  <span className="text-muted-foreground">{getFieldCount(trigger)} 个输入字段</span>
                  <span className="text-muted-foreground">
                    {RUNTIME_LABELS[trigger.project.runtimeTarget] || "工程运行"}
                  </span>
                  <span className="text-muted-foreground ml-auto inline-flex items-center gap-1.5">
                    {trigger.isEnabled ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <CircleSlash2 className="size-3.5" />
                    )}
                    {trigger.isEnabled ? "已启用" : "已停用"}
                  </span>
                </div>
                <div className="text-muted-foreground mt-2 flex items-center justify-between border-t pt-2 text-[11px]">
                  <span
                    className={
                      trigger.project.isPublished
                        ? "text-emerald-600 dark:text-emerald-400"
                        : undefined
                    }
                  >
                    {trigger.project.isPublished ? "工程已发布，可执行" : "工程尚未发布"}
                  </span>
                  <span>更新于 {formatTime(trigger.updatedAt)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <TriggerEditorDialog
        open={editorOpen}
        trigger={editingTrigger}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingTrigger(null);
        }}
      />
      <TriggerRunDialog
        open={runOpen}
        trigger={runningTrigger}
        onOpenChange={(open) => {
          setRunOpen(open);
          if (!open) setRunningTrigger(null);
        }}
      />
    </PageShell>
  );
}
