import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@buildingai/ui/components/ui/input-group";
import { SidebarTrigger } from "@buildingai/ui/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { Bot, LayoutGrid, Search, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AgentSquarePage } from "@/pages/agents";
import AppsIndexPage from "@/pages/apps";

export const meta = definePageMeta({
  title: "市场",
  description: "发现应用与智能体",
  icon: "store",
});

type MarketTab = "apps" | "agents";

function isMarketTab(value: string | null): value is MarketTab {
  return value === "apps" || value === "agents";
}

export default function MarketPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchByTab, setSearchByTab] = useState<Record<MarketTab, string>>({
    apps: "",
    agents: "",
  });
  const activeTab = useMemo<MarketTab>(
    () => (isMarketTab(searchParams.get("tab")) ? (searchParams.get("tab") as MarketTab) : "apps"),
    [searchParams],
  );
  const activeSearch = searchByTab[activeTab];

  useDocumentHead({ title: activeTab === "agents" ? "智能体广场" : "应用广场" });

  const changeTab = (value: string) => {
    if (!isMarketTab(value)) return;
    setSearchParams(value === "apps" ? {} : { tab: value });
  };

  return (
    <div className="bg-muted/20 h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl px-5 py-5 md:px-8 md:py-7">
        <div className="-mx-2 -mt-1 mb-3 flex h-8 items-center md:hidden">
          <SidebarTrigger />
        </div>
        <header className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="bg-foreground text-background mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg shadow-xs">
              <Store className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wide">
                资源市场
              </div>
              <h1 className="text-2xl leading-tight font-semibold tracking-tight md:text-[1.75rem]">
                市场
              </h1>
              <p className="text-muted-foreground mt-1 text-sm leading-5">
                发现可直接使用的应用和智能体
              </p>
            </div>
          </div>
          <InputGroup className="bg-background w-full shadow-xs sm:w-80">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={activeSearch}
              onChange={(event) =>
                setSearchByTab((current) => ({ ...current, [activeTab]: event.target.value }))
              }
              placeholder={activeTab === "apps" ? "搜索应用" : "搜索智能体"}
              aria-label={activeTab === "apps" ? "搜索应用" : "搜索智能体"}
            />
          </InputGroup>
        </header>

        <Tabs value={activeTab} onValueChange={changeTab} className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList
              variant="default"
              className="bg-background h-11 w-full justify-start gap-1 rounded-lg border p-1 shadow-xs sm:w-fit"
            >
              <TabsTrigger
                value="apps"
                className="h-9 flex-1 justify-start px-3 text-xs sm:flex-none sm:px-4 sm:text-sm"
              >
                <LayoutGrid />
                应用广场
              </TabsTrigger>
              <TabsTrigger
                value="agents"
                className="h-9 flex-1 justify-start px-3 text-xs sm:flex-none sm:px-4 sm:text-sm"
              >
                <Bot />
                智能体广场
              </TabsTrigger>
            </TabsList>
            <p className="text-muted-foreground hidden text-xs sm:block">
              {activeTab === "apps" ? "应用、工程与系统工具" : "社区公开的智能体"}
            </p>
          </div>
          <TabsContent value="apps" className="mt-0 focus-visible:outline-none">
            <AppsIndexPage
              embedded
              searchValue={searchByTab.apps}
              onSearchChange={(value) => setSearchByTab((current) => ({ ...current, apps: value }))}
            />
          </TabsContent>
          <TabsContent value="agents" className="mt-0 focus-visible:outline-none">
            <AgentSquarePage
              embedded
              searchValue={searchByTab.agents}
              onSearchChange={(value) =>
                setSearchByTab((current) => ({ ...current, agents: value }))
              }
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
