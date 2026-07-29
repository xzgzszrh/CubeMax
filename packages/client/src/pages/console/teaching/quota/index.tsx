import {
  type ConsoleOrganization,
  useConsoleOrganizationsQuery,
  useConsoleTopupQuotaMutation,
} from "@buildingai/services/console";
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
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/layouts/console/_components/page-container";

/**
 * 班级额度池充值。
 *
 * 池内额度由老师在讲台的「额度管理」里划拨给学生，
 * 划拨会直接写入学生的积分账户（`user.power`）并留下流水。
 */
const TeachingQuotaPage = () => {
  const [keyword, setKeyword] = useState("");
  const [target, setTarget] = useState<ConsoleOrganization | null>(null);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

  const { data: organizations = [], isLoading } = useConsoleOrganizationsQuery(keyword);

  useEffect(() => {
    if (target) {
      setAmount("");
      setRemark("");
    }
  }, [target]);

  const topup = useConsoleTopupQuotaMutation({
    onSuccess: () => {
      toast.success("充值成功");
      setTarget(null);
    },
  });

  const parsed = Number(amount);
  const invalid = !Number.isInteger(parsed) || parsed < 1;

  return (
    <PageContainer>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          给班级额度池充值，老师再从池中划拨给学生。划拨后即为学生的可用积分。
        </p>
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            className="pl-8"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索组织名称或编号"
          />
        </div>
      </div>

      <div className="border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>组织</TableHead>
              <TableHead className="text-right">成员</TableHead>
              <TableHead className="text-right">池内余额</TableHead>
              <TableHead className="text-right">累计充值</TableHead>
              <TableHead className="text-right">累计划拨</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  加载中…
                </TableCell>
              </TableRow>
            ) : organizations.length ? (
              organizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell>
                    <p className="font-medium">{organization.name}</p>
                    <p className="text-muted-foreground text-xs">编号 {organization.code}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {organization.memberCount}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {organization.quotaBalance}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {organization.quotaTotalGranted}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {organization.quotaTotalAllocated}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setTarget(organization)}>
                      <Plus /> 充值
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  暂无组织
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>给「{target?.name}」充值额度</DialogTitle>
            <DialogDescription>
              当前池内余额 {target?.quotaBalance ?? 0}。充值只影响班级额度池，不会直接改动学生积分。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="topup-amount">充值数量</Label>
              <Input
                id="topup-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="topup-remark">备注（可选）</Label>
              <Input
                id="topup-remark"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              取消
            </Button>
            <Button
              loading={topup.isPending}
              disabled={invalid}
              onClick={() =>
                target &&
                topup.mutate({
                  organizationId: target.id,
                  amount: parsed,
                  remark: remark.trim() || undefined,
                })
              }
            >
              确认充值
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default TeachingQuotaPage;
