import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import type { Extension } from "@buildingai/services/console";
import { useSetUserConfigMutation, useUserConfigByGroupQuery } from "@buildingai/services/shared";
import type { Tag, WorkflowItem } from "@buildingai/services/web";
import {
  getActiveOrganizationId,
  getExtensionApplicationViews,
  getSidebarApplicationKey,
  listTags,
  normalizeSidebarApplicationRefs,
  OrganizationRole,
  SIDEBAR_PREFERENCES_GROUP,
  SIDEBAR_PREFERENCES_KEY,
  SIDEBAR_SYSTEM_APPLICATIONS,
  sidebarApplicationRefKey,
  useMyAppScopeQuery,
  useWebAppsDecorateItemsInfiniteQuery,
  useWebAppsDecorateQuery,
  useWorkflowListQuery,
  useWorkspaceContextQuery,
} from "@buildingai/services/web";
import { useAuthStore } from "@buildingai/stores";
import { type IconName, LucideIcon } from "@buildingai/ui/components/lucide-icon";
import { AspectRatio } from "@buildingai/ui/components/ui/aspect-ratio";
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
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { SidebarTrigger } from "@buildingai/ui/components/ui/sidebar";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { cn } from "@buildingai/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Pin,
  PinOff,
  Search,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export const meta = definePageMeta({
  title: "应用中心",
  description: "选择你想要的应用",
  icon: "layout-grid",
});

function extToDisplayItem(ext: Extension, studentView: boolean) {
  const views = getExtensionApplicationViews(ext);
  const studentPath = studentView ? views.student : undefined;
  return {
    id: ext.id,
    appType: "extension" as const,
    appRefId: ext.id,
    sidebarKey: sidebarApplicationRefKey("extension", ext.id),
    name: ext.name,
    title: ext.alias || ext.name,
    description: ext.aliasDescription || ext.description || "",
    avatar: ext.aliasIcon || ext.icon,
    visible: ext.aliasShow ?? true,
    path: `/apps/${ext.identifier}${studentPath ? `/${studentPath}` : ""}`,
    supportsStudentView: typeof views.student === "string",
    kind: "extension" as const,
  };
}

function isLegacySimpleBlog(ext: Pick<Extension, "identifier">) {
  return ext.identifier === "simple-blog";
}

function workflowToDisplayItem(workflow: WorkflowItem) {
  return {
    id: `workflow:${workflow.id}`,
    appType: "workflow" as const,
    appRefId: workflow.id,
    sidebarKey: sidebarApplicationRefKey("workflow", workflow.id),
    name: workflow.name,
    title: workflow.name,
    description: workflow.description?.trim() || "已发布工作流",
    avatar: undefined,
    visible: true,
    path: `/apps/workflows/${workflow.id}`,
    kind: "workflow" as const,
  };
}

function systemToDisplayItem(system: (typeof SIDEBAR_SYSTEM_APPLICATIONS)[number]) {
  return {
    id: `system:${system.appRefId}`,
    appType: "system" as const,
    appRefId: system.appRefId,
    sidebarKey: sidebarApplicationRefKey("system", system.appRefId),
    name: system.title,
    title: system.title,
    description: system.description,
    avatar: undefined,
    icon: system.icon,
    visible: true,
    path: system.path,
    kind: "system" as const,
  };
}

type DisplayAppItem =
  | ReturnType<typeof extToDisplayItem>
  | ReturnType<typeof workflowToDisplayItem>
  | ReturnType<typeof systemToDisplayItem>;

const AppItem = ({
  item,
  isPinned,
  isForced,
  onTogglePin,
}: {
  item: DisplayAppItem;
  isPinned: boolean;
  isForced: boolean;
  onTogglePin: (item: DisplayAppItem) => void;
}) => {
  const openItem = () => {
    window.location.href = item.path;
  };

  return (
    <article
      className="group bg-background hover:border-foreground/25 relative flex min-h-44 cursor-pointer flex-col rounded-lg border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-sm"
      role="link"
      tabIndex={0}
      onClick={openItem}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openItem();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <Avatar className="bg-muted size-11 rounded-lg after:rounded-lg">
          <AvatarImage src={item.avatar} className="rounded-lg" />
          <AvatarFallback className="rounded-lg">
            {item.kind === "workflow" ? (
              <WorkflowIcon className="size-5" />
            ) : item.kind === "system" ? (
              <LucideIcon name={item.icon as IconName} className="size-5" />
            ) : (
              item.title.slice(0, 2).toUpperCase()
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button
            size="icon-sm"
            variant={isPinned ? "secondary" : "ghost"}
            className="rounded-md"
            aria-label={isForced ? "组织已强制置顶" : isPinned ? "移出侧边栏" : "添加到侧边栏"}
            title={isForced ? "组织已强制置顶" : isPinned ? "移出侧边栏" : "添加到侧边栏"}
            disabled={isForced}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin(item);
            }}
          >
            {isForced || !isPinned ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
          </Button>
        </div>
      </div>
      <div className="mt-5 min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{item.title}</h3>
          {item.kind === "workflow" && (
            <Badge variant="outline" className="shrink-0 font-normal">
              编程
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
          {item.description || "暂无说明"}
        </p>
      </div>
      <div className="text-muted-foreground mt-auto flex items-center gap-2 pt-5 text-[11px]">
        <span className="truncate">
          {item.kind === "system"
            ? "系统应用"
            : item.kind === "workflow"
              ? "已发布工程"
              : "扩展应用"}
        </span>
        {isForced ? <span className="text-foreground ml-auto">组织固定</span> : null}
        <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      </div>
    </article>
  );
};

type AppsIndexPageProps = {
  embedded?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
};

const AppsIndexPage = ({ embedded = false, searchValue, onSearchChange }: AppsIndexPageProps) => {
  const { isLogin } = useAuthStore((state) => state.authActions);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [localSearchKeyword, setLocalSearchKeyword] = useState("");
  const searchKeyword = searchValue ?? localSearchKeyword;
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { data: sidebarConfig } = useUserConfigByGroupQuery(SIDEBAR_PREFERENCES_GROUP, {
    enabled: isLogin(),
  });
  const setUserConfig = useSetUserConfigMutation();

  const updateSearchKeyword = (value: string) => {
    if (onSearchChange) onSearchChange(value);
    else setLocalSearchKeyword(value);
  };

  useDocumentHead({
    title: embedded ? "应用广场" : "应用",
  });

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(searchKeyword), 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // 获取装饰配置（标题、描述、banner）
  const { data: config } = useWebAppsDecorateQuery();

  // 获取标签列表
  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ["tags", "app-center"],
    queryFn: () => listTags({ type: "app-center" }),
  });

  // 无限滚动查询应用列表
  const {
    data: itemsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: itemsLoading,
  } = useWebAppsDecorateItemsInfiniteQuery({
    keyword: debouncedKeyword || undefined,
    tagId: selectedTagId || undefined,
    pageSize: 20,
  });

  const { data: publishedWorkflows, isLoading: workflowsLoading } = useWorkflowListQuery(
    {
      page: 1,
      pageSize: 100,
      keyword: debouncedKeyword || undefined,
      isPublished: true,
    },
    { enabled: selectedTagId === null },
  );

  // 当前班级的应用可见范围；个人空间下查询被禁用，返回 undefined 即不过滤。
  const { data: appScope } = useMyAppScopeQuery();
  const { data: workspaceContext } = useWorkspaceContextQuery();
  const activeOrganizationId = getActiveOrganizationId();
  const activeOrganization = workspaceContext?.organizations.find(
    (organization) => organization.id === activeOrganizationId,
  );
  const isStudentView = Boolean(
    activeOrganization &&
    activeOrganization.roles.includes(OrganizationRole.STUDENT) &&
    !activeOrganization.roles.some((role) =>
      [OrganizationRole.TEACHER, OrganizationRole.ADMIN, OrganizationRole.SCHOOL_ADMIN].some(
        (managedRole) => managedRole === role,
      ),
    ),
  );

  const pinnedRefs = useMemo(() => {
    const configured = normalizeSidebarApplicationRefs(sidebarConfig?.[SIDEBAR_PREFERENCES_KEY]);
    // Existing users receive the four host applications in their sidebar on
    // first use; after they save, their explicit selection is authoritative.
    if (sidebarConfig?.[SIDEBAR_PREFERENCES_KEY] === undefined) {
      return SIDEBAR_SYSTEM_APPLICATIONS.filter(
        (item) => item.appRefId !== "my-assignments" || Boolean(activeOrganization),
      ).map((item) => ({ appType: "system" as const, appRefId: item.appRefId }));
    }
    return configured;
  }, [activeOrganization, sidebarConfig]);
  const pinnedKeys = useMemo(
    () => new Set(pinnedRefs.map((ref) => getSidebarApplicationKey(ref))),
    [pinnedRefs],
  );
  const forcedKeys = useMemo(() => {
    const sidebar = appScope?.sidebar;
    return new Set([
      ...(sidebar?.systemIds ?? []).map((id) => sidebarApplicationRefKey("system", id)),
      ...(sidebar?.extensionIds ?? []).map((id) => sidebarApplicationRefKey("extension", id)),
      ...(sidebar?.workflowIds ?? []).map((id) => sidebarApplicationRefKey("workflow", id)),
    ]);
  }, [appScope?.sidebar]);

  const togglePin = (item: DisplayAppItem) => {
    if (!isLogin() || forcedKeys.has(item.sidebarKey) || setUserConfig.isPending) return;
    const next = new Map(pinnedRefs.map((ref) => [getSidebarApplicationKey(ref), ref]));
    if (next.has(item.sidebarKey)) next.delete(item.sidebarKey);
    else next.set(item.sidebarKey, { appType: item.appType, appRefId: item.appRefId });
    setUserConfig.mutate({
      key: SIDEBAR_PREFERENCES_KEY,
      group: SIDEBAR_PREFERENCES_GROUP,
      value: [...next.values()],
    });
  };

  // 配置数据
  const pageTitle = embedded ? config?.title || "应用广场" : config?.title || "应用中心";
  const pageDescription = config?.description || "与你喜爱的应用进行交互";
  const bannerEnabled = config?.enabled ?? false;
  const banners = useMemo(() => {
    if (!config?.enabled) return [];
    return config.banners?.filter((b) => b.imageUrl) || [];
  }, [config]);

  // 应用列表（仅展示 visible 的）
  const displayItems = useMemo<DisplayAppItem[]>(() => {
    const systemItems =
      selectedTagId === null
        ? SIDEBAR_SYSTEM_APPLICATIONS.filter(
            (item) => item.appRefId !== "my-assignments" || Boolean(activeOrganization),
          ).map(systemToDisplayItem)
        : [];
    const extensionItems = (itemsData?.pages ?? [])
      .flatMap((page) => page.items)
      .filter((extension) => !isLegacySimpleBlog(extension))
      .map((extension) => extToDisplayItem(extension, isStudentView))
      .filter((item) => item.visible && (!isStudentView || item.supportsStudentView));
    const workflowItems =
      selectedTagId === null ? (publishedWorkflows?.items ?? []).map(workflowToDisplayItem) : [];
    const items = [...systemItems, ...workflowItems, ...extensionItems];

    // 班级开启应用白名单后，学生只能看到老师授权过的应用。
    if (!appScope?.restricted) return items;
    const systemIds = new Set(appScope.systemIds);
    const extensionIds = new Set(appScope.extensionIds);
    const workflowIds = new Set(appScope.workflowIds);
    return items.filter((item) =>
      item.kind === "system"
        ? systemIds.has(item.appRefId)
        : item.kind === "workflow"
          ? workflowIds.has(item.appRefId)
          : extensionIds.has(item.appRefId),
    );
  }, [
    activeOrganization,
    appScope,
    isStudentView,
    itemsData,
    publishedWorkflows?.items,
    selectedTagId,
  ]);

  // 无限滚动观察
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleBannerClick = (banner: (typeof banners)[number]) => {
    if (!banner.linkUrl) return;
    if (banner.linkType === "system") window.location.href = banner.linkUrl;
    else window.open(banner.linkUrl, "_blank");
  };

  const searchField = (
    <InputGroup className="w-full sm:w-72">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        placeholder="搜索应用"
        value={searchKeyword}
        onChange={(event) => updateSearchKeyword(event.target.value)}
        aria-label="搜索应用"
      />
    </InputGroup>
  );

  const pageContent = (
    <div className={embedded ? "w-full" : "mx-auto w-full max-w-7xl px-5 py-5 md:px-8 md:py-7"}>
      {!embedded ? (
        <div className="-mx-2 -mt-1 mb-3 flex h-8 items-center md:hidden">
          <SidebarTrigger />
        </div>
      ) : null}
      {!embedded ? (
        <header className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-foreground text-background mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg shadow-xs">
              <LayoutGrid className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide">
                应用中心
              </div>
              <h1 className="text-2xl leading-tight font-semibold tracking-tight md:text-[1.75rem]">
                {pageTitle}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm leading-5">{pageDescription}</p>
            </div>
          </div>
          <div className="w-full sm:w-80">{searchField}</div>
        </header>
      ) : null}

      <section className="pt-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-muted-foreground text-[11px] font-medium tracking-wide">
              精选推荐
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">值得先试的应用</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              从一个应用开始，把常用能力放到手边。
            </p>
          </div>
          <span className="text-muted-foreground text-xs tabular-nums">
            {displayItems.length} 个可用应用
          </span>
        </div>
        {bannerEnabled && banners.length > 0 ? (
          <div
            className={cn(
              "grid gap-3",
              banners.length > 1 ? "lg:grid-cols-[1.65fr_1fr]" : "grid-cols-1",
            )}
          >
            {banners.slice(0, 2).map((banner, index) => (
              <button
                type="button"
                key={`${banner.imageUrl}-${index}`}
                className="group bg-background hover:border-foreground/25 overflow-hidden rounded-lg border text-left shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-default disabled:opacity-100"
                onClick={() => handleBannerClick(banner)}
                disabled={!banner.linkUrl}
              >
                <AspectRatio ratio={index === 0 ? 2.6 : 1.8}>
                  <img
                    src={banner.imageUrl}
                    alt={`精选应用 ${index + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </AspectRatio>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-muted-foreground text-[11px] font-medium tracking-wide">
                      精选应用
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium">立即打开并开始使用</div>
                  </div>
                  <ArrowUpRight className="text-muted-foreground ml-auto size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1.45fr_1fr]">
            <div className="bg-primary text-primary-foreground flex min-h-36 flex-col justify-between rounded-lg p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <span className="bg-primary-foreground/15 flex size-10 shrink-0 items-center justify-center rounded-md">
                  <LayoutGrid className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">准备好开始了吗？</p>
                  <p className="text-primary-foreground/70 mt-1 text-xs">把常用能力放到手边。</p>
                </div>
              </div>
              <p className="text-primary-foreground/75 mt-5 max-w-md text-xs leading-5">
                从应用、已发布工程或系统工具中选择一个，直接进入工作流。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background flex min-h-36 flex-col justify-between rounded-lg border p-4 shadow-xs">
                <span className="text-muted-foreground text-[11px] font-medium tracking-wide">
                  可用应用
                </span>
                <span className="text-2xl font-semibold tabular-nums">{displayItems.length}</span>
              </div>
              <div className="bg-background flex min-h-36 flex-col justify-between rounded-lg border p-4 shadow-xs">
                <span className="text-muted-foreground text-[11px] font-medium tracking-wide">
                  使用方式
                </span>
                <span className="text-sm leading-5 font-semibold">打开即用</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-9">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">全部应用</h2>
            <p className="text-muted-foreground mt-1 text-xs">应用、已发布工程和系统工具</p>
          </div>
          <span className="text-muted-foreground text-xs">按类别筛选</span>
        </div>

        {tags.length > 0 ? (
          <div className="no-scrollbar mt-4 flex flex-nowrap gap-1.5 overflow-x-auto pb-1">
            <Badge
              variant={selectedTagId === null ? "default" : "secondary"}
              className="h-8 cursor-pointer px-3 text-xs font-medium shadow-xs"
              onClick={() => setSelectedTagId(null)}
            >
              全部
            </Badge>
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedTagId === tag.id ? "default" : "secondary"}
                className="h-8 cursor-pointer px-3 text-xs font-medium shadow-xs"
                onClick={() => setSelectedTagId(tag.id)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          {itemsLoading || workflowsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-background flex min-h-44 flex-col rounded-lg border p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <Skeleton className="size-11 rounded-lg" />
                    <Skeleton className="size-7 rounded-md" />
                  </div>
                  <Skeleton className="mt-5 h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-4/5" />
                  <Skeleton className="mt-auto h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : displayItems.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {displayItems.map((item) => (
                <AppItem
                  key={item.id}
                  item={item}
                  isPinned={pinnedKeys.has(item.sidebarKey) || forcedKeys.has(item.sidebarKey)}
                  isForced={forcedKeys.has(item.sidebarKey)}
                  onTogglePin={togglePin}
                />
              ))}
            </div>
          ) : (
            <Empty className="bg-background min-h-64 rounded-lg border-dashed shadow-xs">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <WorkflowIcon />
                </EmptyMedia>
                <EmptyTitle>暂无应用</EmptyTitle>
                <EmptyDescription>暂时没有符合当前筛选条件的应用。</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={() => setSelectedTagId(null)}>
                  清除筛选
                </Button>
              </EmptyContent>
            </Empty>
          )}

          <div ref={sentinelRef} className="flex justify-center py-5">
            {isFetchingNextPage ? (
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );

  if (embedded) return pageContent;

  return (
    <ScrollArea className="h-dvh" viewportClassName="[&_>div]:block!">
      {pageContent}
    </ScrollArea>
  );
};

export default AppsIndexPage;
