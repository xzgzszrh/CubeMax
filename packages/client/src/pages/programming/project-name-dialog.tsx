import type { ProgrammingProjectType } from "@buildingai/services/web";
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
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { Check, CircuitBoard, MessageCircle, Puzzle, SquareDashed } from "lucide-react";
import { type FormEvent, useEffect, useId, useState } from "react";

const MAX_PROJECT_NAME_LENGTH = 100;
const EXAMPLE_PROJECT_NAME = "CubeCat 智能巡线";

const DECRYPT_TEMPLATE = {
  id: "decrypt" as const,
  name: "解密馆",
  description: "小智按解密表现挑选下一关，题目由 Lua 在 CubeCat 上出题和判定。",
};

function typeCardClass(selected: boolean) {
  return `group relative flex min-h-28 flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ${
    selected
      ? "border-primary bg-primary/5 ring-primary/20 ring-2"
      : "hover:border-foreground/30 bg-background"
  }`;
}

interface ProjectNameDialogProps {
  mode: "create" | "edit";
  open: boolean;
  initialName?: string;
  initialDescription?: string;
  initialProjectType?: ProgrammingProjectType;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: {
    name: string;
    description: string;
    projectType?: ProgrammingProjectType;
    template?: "decrypt";
  }) => void;
}

export function ProjectNameDialog({
  mode,
  open,
  initialName = "",
  initialDescription = "",
  initialProjectType = "conversation",
  isPending = false,
  onOpenChange,
  onSubmit,
}: ProjectNameDialogProps) {
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [projectType, setProjectType] = useState<ProgrammingProjectType>(initialProjectType);
  const [useTemplate, setUseTemplate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDescription(initialDescription);
    setProjectType(initialProjectType);
    setUseTemplate(false);
  }, [initialDescription, initialName, initialProjectType, open]);

  const normalizedName = name.trim();
  const normalizedDescription = description.trim();
  const unchanged =
    mode === "edit" &&
    normalizedName === initialName.trim() &&
    normalizedDescription === initialDescription.trim();
  const canSubmit = Boolean(normalizedName) && !unchanged && !isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) {
      onSubmit({
        name: normalizedName,
        description: normalizedDescription,
        ...(mode === "create"
          ? {
              projectType,
              ...(projectType === "application" && useTemplate
                ? { template: DECRYPT_TEMPLATE.id }
                : {}),
            }
          : {}),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新建工程" : "工程信息"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "先选择工程形态，之后可以在画布中继续搭建。"
              : "修改工程名称和说明。"}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          {mode === "create" && (
            <div className="grid gap-2">
              <Label>工程类型</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={typeCardClass(projectType === "conversation")}
                  onClick={() => {
                    setProjectType("conversation");
                    setUseTemplate(false);
                  }}
                  aria-pressed={projectType === "conversation"}
                >
                  <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
                    <MessageCircle className="size-4" />
                  </span>
                  <span className="text-sm font-semibold">对话流</span>
                  <span className="text-muted-foreground text-xs leading-4">
                    处理文字输入、模型推理和回复输出
                  </span>
                  {projectType === "conversation" && (
                    <Check className="text-primary absolute top-3 right-3 size-4" />
                  )}
                </button>
                <button
                  type="button"
                  className={typeCardClass(projectType === "application")}
                  onClick={() => setProjectType("application")}
                  aria-pressed={projectType === "application"}
                >
                  <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
                    <CircuitBoard className="size-4" />
                  </span>
                  <span className="text-sm font-semibold">应用</span>
                  <span className="text-muted-foreground text-xs leading-4">
                    从开始节点编排设备、Lua 和智能动作
                  </span>
                  {projectType === "application" && (
                    <Check className="text-primary absolute top-3 right-3 size-4" />
                  )}
                </button>
              </div>
            </div>
          )}
          {mode === "create" && projectType === "application" && (
            <div className="grid gap-2">
              <Label>从模板进行创建</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={typeCardClass(!useTemplate)}
                  onClick={() => {
                    setUseTemplate(false);
                    if (name.trim() === DECRYPT_TEMPLATE.name) setName("");
                    if (description.trim() === DECRYPT_TEMPLATE.description) setDescription("");
                  }}
                  aria-pressed={!useTemplate}
                >
                  <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
                    <SquareDashed className="size-4" />
                  </span>
                  <span className="text-sm font-semibold">空白应用</span>
                  <span className="text-muted-foreground text-xs leading-4">
                    从开始节点自己编排设备、Lua 和智能动作
                  </span>
                  {!useTemplate && <Check className="text-primary absolute top-3 right-3 size-4" />}
                </button>
                <button
                  type="button"
                  className={typeCardClass(useTemplate)}
                  onClick={() => {
                    setUseTemplate(true);
                    if (!name.trim() || name.trim() === EXAMPLE_PROJECT_NAME) {
                      setName(DECRYPT_TEMPLATE.name);
                    }
                    if (!description.trim()) setDescription(DECRYPT_TEMPLATE.description);
                  }}
                  aria-pressed={useTemplate}
                >
                  <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
                    <Puzzle className="size-4" />
                  </span>
                  <span className="text-sm font-semibold">{DECRYPT_TEMPLATE.name}</span>
                  <span className="text-muted-foreground text-xs leading-4">
                    {DECRYPT_TEMPLATE.description}
                  </span>
                  {useTemplate && <Check className="text-primary absolute top-3 right-3 size-4" />}
                </button>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor={nameId}>工程名称</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`例如：${EXAMPLE_PROJECT_NAME}`}
              maxLength={MAX_PROJECT_NAME_LENGTH}
              autoFocus
              disabled={isPending}
            />
            <p className="text-muted-foreground text-right text-xs">
              {name.length}/{MAX_PROJECT_NAME_LENGTH}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={descriptionId}>说明</Label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="工程目标或硬件行为"
              maxLength={500}
              className="min-h-24 resize-none"
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" loading={isPending} disabled={!canSubmit}>
              {mode === "create" ? "创建工程" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
