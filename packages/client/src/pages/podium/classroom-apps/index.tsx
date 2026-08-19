import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import { getExtensionApplicationViews, useAppGrantsQuery } from "@buildingai/services/web";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@buildingai/ui/components/ui/item";
import { ChevronRight, LayoutGrid, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { PodiumPage } from "../_components/podium-page";

export const meta = definePageMeta({
  title: "课堂应用",
  description: "启动应用的教师控制端",
  icon: "app-window",
});

export default function PodiumClassroomAppsPage() {
  useDocumentHead({ title: "课堂应用" });
  const { data: matrix, isLoading } = useAppGrantsQuery();
  const apps = (matrix?.items ?? []).filter(
    (app) =>
      app.appType === "extension" &&
      app.identifier &&
      typeof getExtensionApplicationViews(app).teacher === "string",
  );

  return (
    <PodiumPage title="课堂应用" description="选择应用，打开当前班级的教师控制端。">
      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      ) : apps.length ? (
        <div className="divide-y border-y">
          {apps.map((app) => {
            const teacherView = getExtensionApplicationViews(app).teacher;
            const path = `/podium/classroom-apps/${app.identifier}${teacherView ? `/${teacherView}` : ""}`;
            return (
              <Item key={app.appRefId} className="px-1 py-4">
                <ItemMedia>
                  <Avatar className="size-10 rounded-md after:rounded-md">
                    <AvatarImage src={app.icon ?? undefined} className="rounded-md" />
                    <AvatarFallback className="rounded-md">
                      <LayoutGrid className="size-5" />
                    </AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{app.name}</ItemTitle>
                  <ItemDescription>{app.description || "课堂互动应用"}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button size="icon-sm" variant="outline" asChild aria-label={`打开${app.name}`}>
                    <Link to={path}>
                      <ChevronRight />
                    </Link>
                  </Button>
                </ItemActions>
              </Item>
            );
          })}
        </div>
      ) : (
        <div className="text-muted-foreground flex min-h-40 items-center justify-center text-sm">
          暂无提供教师控制端的应用
        </div>
      )}
    </PodiumPage>
  );
}
