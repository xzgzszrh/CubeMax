import {
  useConsoleOrganizationsQuery,
  useConsoleTeachingDevicesQuery,
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

const ACCOUNT_STATUS = {
  active: { text: "正常", variant: "secondary" as const },
  auth_error: { text: "登录失效", variant: "destructive" as const },
  sync_error: { text: "同步异常", variant: "outline" as const },
};

/** 跨组织的方糖猫资产总览，只读；具体操作仍在对应老师的讲台里完成。 */
const TeachingDevicePage = () => {
  const [organizationId, setOrganizationId] = useState<string>(ALL);
  const { data: organizations = [] } = useConsoleOrganizationsQuery();
  const { data, isLoading } = useConsoleTeachingDevicesQuery(
    organizationId === ALL ? undefined : organizationId,
  );

  return (
    <PageContainer>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          汇总全站方糖猫账号与智能体分发情况。绑定、解绑等操作请在对应班级的讲台中进行。
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

      <Tabs defaultValue="agents">
        <TabsList variant="line">
          <TabsTrigger value="agents">智能体（{data?.agents.length ?? 0}）</TabsTrigger>
          <TabsTrigger value="accounts">CubeCat 账号（{data?.accounts.length ?? 0}）</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="pt-2">
          <div className="border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>智能体</TableHead>
                  <TableHead>归属</TableHead>
                  <TableHead>分发给</TableHead>
                  <TableHead className="text-right">设备</TableHead>
                  <TableHead>最近连接</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : data?.agents.length ? (
                  data.agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell>{agent.organizationName}</TableCell>
                      <TableCell>{agent.assignedUserName ?? "未分发"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {agent.onlineDeviceCount}/{agent.deviceCount}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {agent.lastConnectedAt ? <TimeText value={agent.lastConnectedAt} /> : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      暂无智能体
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="pt-2">
          <div className="border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账号</TableHead>
                  <TableHead>归属</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近同步</TableHead>
                  <TableHead>最近错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : data?.accounts.length ? (
                  data.accounts.map((account) => {
                    const status = ACCOUNT_STATUS[account.status];
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.label}</TableCell>
                        <TableCell>{account.organizationName}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.text}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {account.lastSyncAt ? <TimeText value={account.lastSyncAt} /> : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-64 truncate text-xs">
                          {account.lastError || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                      暂无账号
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default TeachingDevicePage;
