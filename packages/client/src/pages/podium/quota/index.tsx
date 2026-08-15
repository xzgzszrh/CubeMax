import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import type { QuotaMember } from "@buildingai/services/web";
import {
  useQuotaLogsQuery,
  useQuotaOverviewQuery,
  useTransferQuotaMutation,
} from "@buildingai/services/web";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PodiumPage } from "../_components/podium-page";

export const meta = definePageMeta({
  title: "额度管理",
  description: "查看班级 AI 额度，并给学生划拨或回收额度",
  icon: "wallet",
});

const ACTION_LABELS = {
  topup: "管理员充值",
  allocate: "划拨给学生",
  reclaim: "从学生回收",
};

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "—" : new Date(parsed).toLocaleString();
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex-1 border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function TransferDialog({
  member,
  action,
  poolBalance,
  onClose,
}: {
  member: QuotaMember | null;
  action: "allocate" | "reclaim";
  poolBalance: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

  useEffect(() => {
    if (member) {
      setAmount("");
      setRemark("");
    }
  }, [member]);

  const transfer = useTransferQuotaMutation({
    onSuccess: () => {
      toast.success(action === "allocate" ? "额度已划拨" : "额度已回收");
      onClose();
    },
  });

  const parsed = Number(amount);
  const max = action === "allocate" ? poolBalance : (member?.power ?? 0);
  const invalid = !Number.isInteger(parsed) || parsed < 1 || parsed > max;

  return (
    <Dialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action === "allocate" ? "划拨额度" : "回收额度"}</DialogTitle>
          <DialogDescription>
            {action === "allocate"
              ? `从班级额度池划拨给 ${member?.realName || member?.nickname}，池内可用 ${poolBalance}。`
              : `从 ${member?.realName || member?.nickname} 收回额度到班级池，其当前余额 ${member?.power ?? 0}。`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="quota-amount">数量</Label>
            <Input
              id="quota-amount"
              type="number"
              min={1}
              max={max}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={`最多 ${max}`}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="quota-remark">备注（可选）</Label>
            <Input
              id="quota-remark"
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              maxLength={200}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            loading={transfer.isPending}
            disabled={invalid}
            onClick={() =>
              member &&
              transfer.mutate({
                action,
                userId: member.userId,
                amount: parsed,
                remark: remark.trim() || undefined,
              })
            }
          >
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PodiumQuotaPage = () => {
  useDocumentHead({ title: "额度管理" });
  const { data: overview, isLoading } = useQuotaOverviewQuery();
  const { data: logs = [] } = useQuotaLogsQuery();

  const [target, setTarget] = useState<QuotaMember | null>(null);
  const [action, setAction] = useState<"allocate" | "reclaim">("allocate");

  if (isLoading || !overview) {
    return (
      <PodiumPage title="额度管理">
        <div className="flex min-h-40 items-center justify-center">
          <LoaderCircle className="size-5 animate-spin" />
        </div>
      </PodiumPage>
    );
  }

  return (
    <PodiumPage
      title="额度管理"
      description="班级额度池由管理员充值，你可以从池中划拨给学生，也可以把没用完的额度收回。"
    >
      <div className="flex flex-wrap gap-3">
        <StatCard label="额度池余额" value={overview.pool.balance} hint="可继续划拨给学生的数量" />
        <StatCard label="累计充值" value={overview.pool.totalGranted} hint="管理员给本班充值总额" />
        <StatCard
          label="累计划拨"
          value={overview.pool.totalAllocated}
          hint="已经发放到学生账户的数量"
        />
      </div>

      <Tabs defaultValue="members">
        <TabsList variant="line">
          <TabsTrigger value="members">成员额度</TabsTrigger>
          <TabsTrigger value="logs">变动流水</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="pt-2">
          {overview.members.length ? (
            <div className="overflow-auto border-y">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>成员</TableHead>
                    <TableHead className="text-right">剩余额度</TableHead>
                    <TableHead className="text-right">近 30 天消耗</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.members.map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-8 rounded-md">
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback className="rounded-md">
                              {(member.realName || member.nickname || member.username).slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="max-w-44 truncate font-medium">
                              {member.realName || member.nickname}
                            </p>
                            <p className="text-muted-foreground max-w-44 truncate text-xs">
                              {member.username}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{member.power}</TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">
                        {member.consumed}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={overview.pool.balance < 1}
                            onClick={() => {
                              setAction("allocate");
                              setTarget(member);
                            }}
                          >
                            <ArrowUpRight /> 划拨
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={member.power < 1}
                            onClick={() => {
                              setAction("reclaim");
                              setTarget(member);
                            }}
                          >
                            <ArrowDownLeft /> 回收
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-y text-center">
              <Wallet className="text-muted-foreground size-7" />
              <p className="font-medium">班级里还没有成员</p>
              <p className="text-muted-foreground max-w-sm text-xs">
                先到「人员管理」创建或导入学生账号。
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="pt-2">
          {logs.length ? (
            <div className="overflow-auto border-y">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>对象</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">池内余额</TableHead>
                    <TableHead>操作人</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.action === "topup" ? "default" : "outline"}>
                          {ACTION_LABELS[log.action]}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.targetName ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{log.amount}</TableCell>
                      <TableCell className="text-right tabular-nums">{log.balanceAfter}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {log.operatorName}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 border-y text-center">
              <Wallet className="text-muted-foreground size-7" />
              <p className="font-medium">还没有额度变动</p>
              <p className="text-muted-foreground max-w-sm text-xs">
                管理员在「管理员工作台 · 班级额度」给本班充值后，这里会出现记录。
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TransferDialog
        member={target}
        action={action}
        poolBalance={overview.pool.balance}
        onClose={() => setTarget(null)}
      />
    </PodiumPage>
  );
};

export default PodiumQuotaPage;
