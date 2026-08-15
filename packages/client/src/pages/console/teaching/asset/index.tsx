import {
  useConsoleOrganizationsQuery,
  useConsoleTeachingAssetsQuery,
} from "@buildingai/services/console";
import { Badge } from "@buildingai/ui/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { useState } from "react";

import { PageContainer } from "@/layouts/console/_components/page-container";

const ALL = "all";

const INTERACTION_STATUS: Record<
  string,
  { text: string; variant: "default" | "secondary" | "outline" }
> = {
  draft: { text: "草稿", variant: "outline" },
  active: { text: "进行中", variant: "default" },
  ended: { text: "已结束", variant: "secondary" },
};

/** 跨组织汇总老师创建的场景、快捷指令与课堂活动，便于排查与统计。 */
const TeachingAssetPage = () => {
  const [organizationId, setOrganizationId] = useState<string>(ALL);
  const { data: organizations = [] } = useConsoleOrganizationsQuery();
  const { data, isLoading } = useConsoleTeachingAssetsQuery(
    organizationId === ALL ? undefined : organizationId,
  );

  function renderEmpty(colSpan: number, text: string) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="text-muted-foreground h-24 text-center">
          {isLoading ? "加载中…" : text}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <PageContainer>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          汇总各班级老师创建的教学资产，每类最多展示最近 500 条。
        </p>
        <Select value={organizationId} onValueChange={setOrganizationId}>
          <SelectTrigger className="w-56 px-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部组织</SelectItem>
            {organizations.map((organization) => (
              <SelectItem value={organization.id} key={organization.id}>
                {organization.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="scenes">
        <TabsList variant="line">
          <TabsTrigger value="scenes">场景（{data?.scenes.length ?? 0}）</TabsTrigger>
          <TabsTrigger value="commands">快捷指令（{data?.quickCommands.length ?? 0}）</TabsTrigger>
          <TabsTrigger value="interactions">
            课堂活动（{data?.interactions.length ?? 0}）
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenes" className="pt-2">
          <div className="border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>场景</TableHead>
                  <TableHead>归属</TableHead>
                  <TableHead>创建人</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.scenes.length
                  ? data.scenes.map((scene) => (
                      <TableRow key={scene.id}>
                        <TableCell>
                          <p className="font-medium">{scene.name}</p>
                          <p className="text-muted-foreground max-w-80 truncate text-xs">
                            {scene.description || "无备注"}
                          </p>
                        </TableCell>
                        <TableCell>{scene.organizationName}</TableCell>
                        <TableCell>{scene.ownerName}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          <TimeText value={scene.updatedAt} />
                        </TableCell>
                      </TableRow>
                    ))
                  : renderEmpty(4, "暂无场景")}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="commands" className="pt-2">
          <div className="border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>快捷指令</TableHead>
                  <TableHead>归属</TableHead>
                  <TableHead>创建人</TableHead>
                  <TableHead className="text-right">目标数</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.quickCommands.length
                  ? data.quickCommands.map((command) => (
                      <TableRow key={command.id}>
                        <TableCell className="font-medium">{command.name}</TableCell>
                        <TableCell>{command.organizationName}</TableCell>
                        <TableCell>{command.ownerName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {command.targetCount}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          <TimeText value={command.updatedAt} />
                        </TableCell>
                      </TableRow>
                    ))
                  : renderEmpty(5, "暂无快捷指令")}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="interactions" className="pt-2">
          <div className="border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>课堂活动</TableHead>
                  <TableHead>归属</TableHead>
                  <TableHead>创建人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">目标数</TableHead>
                  <TableHead>更新时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.interactions.length
                  ? data.interactions.map((interaction) => {
                      const status = INTERACTION_STATUS[interaction.status] ?? {
                        text: interaction.status,
                        variant: "outline" as const,
                      };
                      return (
                        <TableRow key={interaction.id}>
                          <TableCell className="font-medium">{interaction.name}</TableCell>
                          <TableCell>{interaction.organizationName}</TableCell>
                          <TableCell>{interaction.ownerName}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.text}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {interaction.targetCount}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            <TimeText value={interaction.updatedAt} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  : renderEmpty(6, "暂无课堂活动")}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default TeachingAssetPage;
