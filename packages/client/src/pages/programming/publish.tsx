import {
  usePublishProgrammingProjectMutation,
  useUnpublishProgrammingProjectMutation,
} from "@buildingai/services/web";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Separator } from "@buildingai/ui/components/ui/separator";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

import { useProgrammingProject } from "./context";

export default function ProjectPublishPage() {
  const project = useProgrammingProject();

  const publishMutation = usePublishProgrammingProjectMutation({
    onSuccess: () => {
      toast.success("工程已发布");
    },
    onError: (error) => toast.error(error.message || "发布失败"),
  });

  const unpublishMutation = useUnpublishProgrammingProjectMutation({
    onSuccess: () => toast.success("已取消发布"),
    onError: (error) => toast.error(error.message || "操作失败"),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8 overflow-y-auto p-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">发布工程</h1>
        <p className="text-muted-foreground text-sm">将工程发布到目标设备或设置为触发器</p>
      </div>

      <Separator />

      {/* 发布状态 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">发布状态</h2>
            <p className="text-muted-foreground text-xs">
              发布后将生成快照，可用于设备运行或触发器调用
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              project.isPublished
                ? "border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700"
                : "text-muted-foreground px-3 py-1"
            }
          >
            {project.isPublished ? "已发布" : "未发布"}
          </Badge>
        </div>

        {project.isPublished && project.publishedAt && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs">发布时间</p>
                <p className="text-sm font-medium">
                  {new Date(project.publishedAt).toLocaleString("zh-CN")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Lua 模块</p>
                <p className="text-sm font-medium">{project.publishedSnapshot?.luaModules?.length ?? 0} 个</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* 发布操作 */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">发布操作</h2>
          <p className="text-muted-foreground text-xs">
            发布前请确保主流程完整（包含开始和结束节点）且引用的 Lua 模块已发布
          </p>
        </div>

        <div className="flex gap-3">
          {project.isPublished ? (
            <Button
              variant="outline"
              onClick={() => unpublishMutation.mutate(project.id)}
              disabled={unpublishMutation.isPending}
            >
              取消发布
            </Button>
          ) : (
            <Button
              onClick={() => publishMutation.mutate(project.id)}
              disabled={publishMutation.isPending}
            >
              <Rocket className="mr-1.5 size-4" />
              {publishMutation.isPending ? "发布中..." : "发布工程"}
            </Button>
          )}
        </div>
      </section>

      <Separator />

      {/* 触发器 */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">触发器</h2>
          <p className="text-muted-foreground text-xs">
            设置触发条件，让设备在满足条件时自动运行此工程
          </p>
        </div>

        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">触发器功能开发中</p>
          <p className="text-muted-foreground text-xs">即将支持定时触发、设备状态触发等</p>
        </div>
      </section>

      <Separator />

      {/* 运行日志 */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">运行日志</h2>
          <p className="text-muted-foreground text-xs">查看工程在设备上的运行记录</p>
        </div>

        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">运行日志功能开发中</p>
          <p className="text-muted-foreground text-xs">即将支持实时日志和历史记录</p>
        </div>
      </section>
    </div>
  );
}
