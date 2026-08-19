import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import {
  type AgentDecorateBannerItem,
  useAgentTags,
  useWebAgentDecorateItemsInfiniteQuery,
  useWebAgentDecorateQuery,
} from "@buildingai/services/web";
import { InfiniteScroll } from "@buildingai/ui/components/infinite-scroll";
import { AspectRatio } from "@buildingai/ui/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import {
  Empty,
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
import { ArrowUpRight, Bot, MessageSquare, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounceValue } from "usehooks-ts";

import AgentsWorkspacePage from "./workspace";

// import { ProviderIcon } from "../../components/provider-icons";

const PAGE_SIZE = 20;

export const meta = definePageMeta({
  title: "我的智能体",
  description: "创建和管理我的智能体",
  icon: "bot",
});

type AgentSquarePageProps = {
  embedded?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
};

export const AgentSquarePage = ({
  embedded = false,
  searchValue,
  onSearchChange,
}: AgentSquarePageProps) => {
  const navigate = useNavigate();
  const [localKeyword, setLocalKeyword] = useState("");
  const keyword = searchValue ?? localKeyword;
  const [debouncedKeyword] = useDebounceValue(keyword.trim(), 300);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const updateKeyword = (value: string) => {
    if (onSearchChange) onSearchChange(value);
    else setLocalKeyword(value);
  };

  useDocumentHead({ title: "智能体广场" });

  const { data: decorateConfig } = useWebAgentDecorateQuery();
  const { data: tagsData } = useAgentTags();
  const tags = tagsData ?? [];

  const squareQuery = useWebAgentDecorateItemsInfiniteQuery(
    {
      pageSize: PAGE_SIZE,
      keyword: debouncedKeyword || undefined,
      tagId: selectedTagId || undefined,
    },
    { enabled: true },
  );

  const items = useMemo(
    () => squareQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [squareQuery.data?.pages],
  );
  const hasNextPage = squareQuery.hasNextPage ?? false;
  const isFetchingNextPage = squareQuery.isFetchingNextPage;

  const banners = useMemo(() => {
    if (!decorateConfig?.enabled) return [];

    if (decorateConfig.banners && decorateConfig.banners.length > 0) {
      return decorateConfig.banners.filter((banner) => banner.imageUrl);
    }

    if (decorateConfig.heroImageUrl) {
      return [
        {
          imageUrl: decorateConfig.heroImageUrl,
          linkUrl: decorateConfig.link?.path,
          linkType: "system" as const,
        },
      ];
    }

    return [];
  }, [decorateConfig]);

  const selectTag = (tagId: string) => {
    setSelectedTagId((prev) => (prev === tagId ? null : tagId));
  };

  const openAgentChat = (agent: { id: string }) => {
    window.location.assign(`/agents/${agent.id}/chat`);
  };

  const handleBannerClick = (banner: AgentDecorateBannerItem) => {
    const path = banner.linkUrl?.trim();
    if (!path) return;
    if (banner.linkType === "custom") {
      window.open(path, "_blank");
      return;
    }
    navigate(path);
  };

  const searchField = (
    <InputGroup className="w-full sm:w-72">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        placeholder="搜索智能体"
        value={keyword}
        onChange={(event) => updateKeyword(event.target.value)}
        aria-label="搜索智能体"
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
              <Bot className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide">
                智能体广场
              </div>
              <h1 className="text-2xl leading-tight font-semibold tracking-tight md:text-[1.75rem]">
                {decorateConfig?.title || "智能体广场"}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm leading-5">
                {decorateConfig?.description || "选择你想要的智能体"}
              </p>
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
            <h2 className="mt-1 text-xl font-semibold tracking-tight">找到适合你的智能体</h2>
            <p className="text-muted-foreground mt-1 text-xs">从社区灵感中挑一个，直接开始对话。</p>
          </div>
          <span className="text-muted-foreground text-xs tabular-nums">
            {items.length} 个公开智能体
          </span>
        </div>
        {banners.length > 0 ? (
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
                className={cn(
                  "group bg-background hover:border-foreground/25 overflow-hidden rounded-lg border text-left shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-default disabled:opacity-100",
                  !banner.linkUrl && "cursor-default",
                )}
                onClick={() => handleBannerClick(banner)}
                disabled={!banner.linkUrl}
              >
                <AspectRatio ratio={index === 0 ? 2.6 : 1.8}>
                  <img
                    src={banner.imageUrl}
                    alt={`精选智能体 ${index + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </AspectRatio>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-muted-foreground text-[11px] font-medium tracking-wide">
                      精选智能体
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium">打开对话，立即开始</div>
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
                  <Bot className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">发现新的对话方式</p>
                  <p className="text-primary-foreground/70 mt-1 text-xs">从一个问题开始。</p>
                </div>
              </div>
              <p className="text-primary-foreground/75 mt-5 max-w-md text-xs leading-5">
                浏览公开智能体，找到适合你的助手，打开即可开始一段对话。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background flex min-h-36 flex-col justify-between rounded-lg border p-4 shadow-xs">
                <span className="text-muted-foreground text-[11px] font-medium tracking-wide">
                  公开智能体
                </span>
                <span className="text-2xl font-semibold tabular-nums">{items.length}</span>
              </div>
              <div className="bg-background flex min-h-36 flex-col justify-between rounded-lg border p-4 shadow-xs">
                <span className="text-muted-foreground text-[11px] font-medium tracking-wide">
                  使用方式
                </span>
                <span className="text-sm leading-5 font-semibold">打开即聊</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-9">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">公开智能体</h2>
          <p className="text-muted-foreground mt-1 text-xs">由社区发布，打开即可开始对话</p>
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
                onClick={() => selectTag(tag.id)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          {squareQuery.isLoading ? (
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
                  <Skeleton className="mt-auto h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <Empty className="bg-background min-h-64 rounded-lg border-dashed shadow-xs">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bot />
                </EmptyMedia>
                <EmptyTitle>{keyword.trim() ? "没有匹配的智能体" : "暂无智能体"}</EmptyTitle>
                <EmptyDescription>
                  {keyword.trim() ? "尝试调整搜索内容。" : "暂时没有可用的公开智能体。"}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <InfiniteScroll
              loading={isFetchingNextPage}
              hasMore={hasNextPage}
              onLoadMore={() => squareQuery.fetchNextPage()}
              emptyText=""
              showEmptyText={!hasNextPage}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((agent) => {
                  const creator = agent.creator;
                  const creatorLabel = creator?.nickname ?? "匿名";
                  const creatorInitial = creatorLabel.slice(0, 1).toUpperCase();
                  return (
                    <article
                      key={agent.id}
                      className="group bg-background hover:border-foreground/25 relative flex min-h-44 cursor-pointer flex-col rounded-lg border p-4 shadow-xs transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                      role="link"
                      tabIndex={0}
                      onClick={() => openAgentChat(agent)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openAgentChat(agent);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Avatar className="bg-muted size-11 rounded-lg after:rounded-lg">
                          <AvatarImage
                            src={agent.avatar ?? creator?.avatar ?? undefined}
                            className="rounded-lg"
                          />
                          <AvatarFallback className="rounded-lg">
                            {agent.name.slice(0, 1).toUpperCase() || <Bot />}
                          </AvatarFallback>
                        </Avatar>
                        <ArrowUpRight className="text-muted-foreground size-4 opacity-100 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                      <h3 className="mt-5 truncate text-sm font-semibold">{agent.name}</h3>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
                        {agent.description?.toString().trim() || "暂无描述"}
                      </p>
                      <div className="text-muted-foreground mt-auto flex items-center gap-2 pt-5 text-[11px]">
                        <Avatar className="size-5 shrink-0">
                          <AvatarImage src={creator?.avatar ?? undefined} />
                          <AvatarFallback className="text-[9px]">
                            {creatorInitial || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 truncate">{creatorLabel}</span>
                        <span className="ml-auto inline-flex items-center gap-1">
                          <MessageSquare className="size-3.5" /> {agent.messageCount}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" /> {agent.userCount}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </InfiniteScroll>
          )}
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

const AgentsIndexPage = () => <AgentsWorkspacePage />;

export default AgentsIndexPage;
