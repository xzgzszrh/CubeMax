import {
  type CreateProgrammingTriggerDto,
  type ProgrammingTriggerItem,
  type UpdateProgrammingTriggerDto,
  useCreateProgrammingTriggerMutation,
  useProgrammingProjectsQuery,
  useUpdateProgrammingTriggerMutation,
} from "@buildingai/services/web";
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
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { formatSchemaType, getProjectInputSchema } from "./schema";

type TriggerEditorDialogProps = {
  open: boolean;
  trigger?: ProgrammingTriggerItem | null;
  onOpenChange: (open: boolean) => void;
};

export function TriggerEditorDialog({ open, trigger, onOpenChange }: TriggerEditorDialogProps) {
  const projectsQuery = useProgrammingProjectsQuery({ page: 1, pageSize: 100 });
  const projects = projectsQuery.data?.items ?? [];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [homeOrder, setHomeOrder] = useState("0");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projectId, projects],
  );
  const inputSchema = selectedProject
    ? getProjectInputSchema(selectedProject)
    : (trigger?.inputSchema ?? { type: "object", properties: {} });
  const fieldEntries = Object.entries(inputSchema.properties ?? {});

  useEffect(() => {
    if (!open) return;
    setName(trigger?.name ?? "");
    setDescription(trigger?.description ?? "");
    setProjectId(trigger?.projectId ?? "");
    setIsEnabled(trigger?.isEnabled ?? true);
    setIsPinned(trigger?.isPinned ?? false);
    setHomeOrder(String(trigger?.homeOrder ?? 0));
  }, [open, trigger]);

  const createMutation = useCreateProgrammingTriggerMutation({
    onSuccess: () => {
      toast.success("触发器已创建");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message || "触发器创建失败"),
  });
  const updateMutation = useUpdateProgrammingTriggerMutation({
    onSuccess: () => {
      toast.success("触发器已更新");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message || "触发器更新失败"),
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("请输入触发器名称");
      return;
    }
    if (!projectId) {
      toast.error("请选择要绑定的编程工程");
      return;
    }
    const base = {
      name: name.trim(),
      description: description.trim() || undefined,
      projectId,
      isEnabled,
      isPinned,
      homeOrder: Math.max(0, Number.parseInt(homeOrder, 10) || 0),
    };
    if (trigger) {
      updateMutation.mutate({ id: trigger.id, dto: base satisfies UpdateProgrammingTriggerDto });
    } else {
      createMutation.mutate(base satisfies CreateProgrammingTriggerDto);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{trigger ? "编辑触发器" : "新建触发器"}</DialogTitle>
          <DialogDescription>
            表单字段会从绑定工程的主流程开始节点自动读取，保存后仍可随工程更新重新同步。
          </DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <ScrollArea className="min-h-0 flex-1 pr-4">
            <div className="space-y-5 py-1">
              <div className="space-y-2">
                <Label htmlFor="trigger-name">名称</Label>
                <Input
                  id="trigger-name"
                  value={name}
                  maxLength={100}
                  placeholder="例如：打开教室灯光"
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-description">说明</Label>
                <Textarea
                  id="trigger-description"
                  value={description}
                  maxLength={500}
                  className="min-h-20"
                  placeholder="说明这个触发器会做什么"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-project">绑定工程</Label>
                <Select value={projectId} onValueChange={setProjectId} disabled={!!trigger}>
                  <SelectTrigger id="trigger-project" className="w-full">
                    <SelectValue
                      placeholder={projectsQuery.isLoading ? "正在加载工程" : "选择一个编程工程"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem value={project.id} key={project.id}>
                        <span className="flex items-center gap-2">
                          <span>{project.name}</span>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {project.isPublished ? "已发布" : "草稿"}
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {trigger ? (
                  <p className="text-muted-foreground text-xs">
                    编辑时不能更换绑定工程，请删除后重新创建。
                  </p>
                ) : null}
              </div>

              <div className="border-t pt-4">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">表单字段</h3>
                    <p className="text-muted-foreground mt-1 text-xs">来自开始节点的输入定义</p>
                  </div>
                  <Badge variant="secondary">{fieldEntries.length} 个字段</Badge>
                </div>
                {fieldEntries.length ? (
                  <div className="divide-y rounded-md border">
                    {fieldEntries.map(([key, schema]) => (
                      <div
                        className="flex items-center justify-between gap-4 px-3 py-2.5"
                        key={key}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">{schema.title || key}</p>
                          {schema.description ? (
                            <p className="text-muted-foreground truncate text-xs">
                              {schema.description}
                            </p>
                          ) : null}
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                          {formatSchemaType(schema)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="bg-muted/30 text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-sm">
                    这个工程没有配置传入参数，触发后会直接运行主流程。
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between gap-4 py-1">
                  <div>
                    <Label htmlFor="trigger-enabled">启用触发器</Label>
                    <p className="text-muted-foreground mt-1 text-xs">
                      停用后仍保留设置，但不能执行。
                    </p>
                  </div>
                  <Switch id="trigger-enabled" checked={isEnabled} onCheckedChange={setIsEnabled} />
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Label htmlFor="trigger-pinned">显示在首页</Label>
                    <p className="text-muted-foreground mt-1 text-xs">为首页快捷触发器预留。</p>
                  </div>
                  <Switch id="trigger-pinned" checked={isPinned} onCheckedChange={setIsPinned} />
                </div>
                {isPinned ? (
                  <div className="flex items-center justify-between gap-4 py-1">
                    <Label htmlFor="trigger-order">首页顺序</Label>
                    <Input
                      id="trigger-order"
                      type="number"
                      min={0}
                      max={100000}
                      className="w-28"
                      value={homeOrder}
                      onChange={(event) => setHomeOrder(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending || projectsQuery.isLoading}>
              {isPending ? "保存中..." : "保存触发器"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
