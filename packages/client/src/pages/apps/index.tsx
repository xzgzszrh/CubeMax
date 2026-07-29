import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import type { Extension } from "@buildingai/services/console";
import type { Tag, WorkflowItem } from "@buildingai/services/web";
import {
  listTags,
  useMyAppScopeQuery,
  useWebAppsDecorateItemsInfiniteQuery,
  useWebAppsDecorateQuery,
  useWorkflowListQuery,
} from "@buildingai/services/web";
import { AspectRatio } from "@buildingai/ui/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Carousel, CarouselContent, CarouselItem } from "@buildingai/ui/components/ui/carousel";
import { Empty, EmptyContent, EmptyDescription } from "@buildingai/ui/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@buildingai/ui/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@buildingai/ui/components/ui/item";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { SidebarTrigger } from "@buildingai/ui/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import Autoplay from "embla-carousel-autoplay";
import { ChevronRight, Loader2, Search, Workflow as WorkflowIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

export const meta = definePageMeta({
  title: "应用中心",
  description: "选择你想要的应用",
  icon: "layout-grid",
});

function extToDisplayItem(ext: Extension) {
  return {
    id: ext.id,
    name: ext.name,
    title: ext.alias || ext.name,
    description: ext.aliasDescription || ext.description || "",
    avatar: ext.aliasIcon || ext.icon,
    visible: ext.aliasShow ?? true,
    path: `/apps/${ext.identifier}`,
    kind: "extension" as const,
  };
}

function workflowToDisplayItem(workflow: WorkflowItem) {
  return {
    id: `workflow:${workflow.id}`,
    name: workflow.name,
    title: workflow.name,
    description: workflow.description?.trim() || "已发布工作流",
    avatar: undefined,
    visible: true,
    path: `/apps/workflows/${workflow.id}`,
    kind: "workflow" as const,
  };
}

type DisplayAppItem =
  | ReturnType<typeof extToDisplayItem>
  | ReturnType<typeof workflowToDisplayItem>;

const AppItem = ({ item }: { item: DisplayAppItem }) => {
  return (
    <Item
      className="group/apps-item hover:bg-accent cursor-pointer px-0 transition-[padding] hover:px-4"
      onClick={() => {
        window.location.href = item.path;
      }}
    >
      <ItemMedia>
        <Avatar className="size-10 rounded-lg after:rounded-lg">
          <AvatarImage src={item.avatar} className="rounded-lg" />
          <AvatarFallback className="rounded-lg">
            {item.kind === "workflow" ? (
              <WorkflowIcon className="size-5" />
            ) : (
              item.title.slice(0, 2).toUpperCase()
            )}
          </AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <div className="flex min-w-0 items-center gap-2">
          <ItemTitle>{item.title}</ItemTitle>
          {item.kind === "workflow" && (
            <Badge variant="outline" className="shrink-0 font-normal">
              工作流
            </Badge>
          )}
        </div>
        <ItemDescription className="line-clamp-1">{item.description}</ItemDescription>
      </ItemContent>
      <ItemActions className="opacity-0 group-hover/apps-item:opacity-100">
        <Button size="icon-sm" variant="outline" className="rounded-full" aria-label="查看" asChild>
          <Link to={item.path}>
            <ChevronRight />
          </Link>
        </Button>
      </ItemActions>
    </Item>
  );
};

const AppsIndexPage = () => {
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  useDocumentHead({
    title: "应用",
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

  // 配置数据
  const pageTitle = config?.title || "应用中心";
  const pageDescription = config?.description || "与你喜爱的应用进行交互";
  const bannerEnabled = config?.enabled ?? false;
  const banners = useMemo(() => {
    if (!config?.enabled) return [];
    return config.banners?.filter((b) => b.imageUrl) || [];
  }, [config]);

  // 应用列表（仅展示 visible 的）
  const displayItems = useMemo<DisplayAppItem[]>(() => {
    const extensionItems = (itemsData?.pages ?? [])
      .flatMap((page) => page.items.map(extToDisplayItem))
      .filter((item) => item.visible);
    const workflowItems =
      selectedTagId === null ? (publishedWorkflows?.items ?? []).map(workflowToDisplayItem) : [];
    const items = [...workflowItems, ...extensionItems];

    // 班级开启应用白名单后，学生只能看到老师授权过的应用。
    if (!appScope?.restricted) return items;
    const extensionIds = new Set(appScope.extensionIds);
    const workflowIds = new Set(appScope.workflowIds);
    return items.filter((item) =>
      item.kind === "workflow"
        ? workflowIds.has(item.id.replace(/^workflow:/, ""))
        : extensionIds.has(item.id),
    );
  }, [appScope, itemsData, publishedWorkflows?.items, selectedTagId]);

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

  return (
    <ScrollArea className="h-dvh" viewportClassName="[&_>div]:block!">
      <div className="flex w-full flex-col items-center">
        <div className="flex h-13 w-full items-center px-2">
          <SidebarTrigger className="md:hidden" />
        </div>

        <div className="w-full max-w-4xl px-4 py-8 pt-12 sm:pt-20 md:px-6">
          <div className="flex flex-col items-center justify-between gap-4 max-sm:items-start sm:flex-row sm:px-3">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl">{pageTitle}</h1>
              <p className="text-muted-foreground text-sm">{pageDescription}</p>
            </div>
            <div className="max-sm:w-full">
              <InputGroup className="rounded-full">
                <InputGroupInput
                  placeholder="搜索应用"
                  value={searchKeyword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchKeyword(e.target.value)
                  }
                />
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
              </InputGroup>
            </div>
          </div>

          {bannerEnabled && banners.length > 0 && (
            <Carousel
              className="mt-8 w-full rounded-2xl sm:rounded-4xl"
              plugins={[
                Autoplay({
                  delay: 3000,
                }),
              ]}
            >
              <CarouselContent>
                {banners.map((banner, index) => (
                  <CarouselItem key={index}>
                    <AspectRatio ratio={4 / 1}>
                      <img
                        src={banner.imageUrl}
                        alt={`banner-${index + 1}`}
                        className="h-full w-full cursor-pointer rounded-2xl object-cover"
                        onClick={() => {
                          if (banner.linkType === "system" && banner.linkUrl) {
                            window.location.href = banner.linkUrl;
                          } else if (banner.linkUrl) {
                            window.open(banner.linkUrl, "_blank");
                          }
                        }}
                      />
                    </AspectRatio>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          )}

          {tags.length > 0 && (
            <div className="no-scrollbar mt-8 flex flex-nowrap gap-2 overflow-x-auto sm:px-3">
              <Badge
                variant={selectedTagId === null ? "default" : "secondary"}
                className="h-9 cursor-pointer px-4 font-medium text-nowrap sm:font-normal"
                onClick={() => setSelectedTagId(null)}
              >
                全部
              </Badge>
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTagId === tag.id ? "default" : "secondary"}
                  className="h-9 cursor-pointer px-4 font-medium text-nowrap sm:font-normal"
                  onClick={() => setSelectedTagId(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-6 sm:px-3">
            {displayItems.length > 0 ? (
              <div className="grid gap-x-4 sm:grid-cols-2">
                {displayItems.map((item) => (
                  <AppItem key={item.id} item={item} />
                ))}
              </div>
            ) : itemsLoading || workflowsLoading ? null : (
              <Empty>
                <EmptyContent>
                  <EmptyDescription>暂无应用</EmptyDescription>
                </EmptyContent>
              </Empty>
            )}

            {/* 滚动加载哨兵 */}
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isFetchingNextPage && (
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              )}
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default AppsIndexPage;
