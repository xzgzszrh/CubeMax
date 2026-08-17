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
import { type FormEvent, useEffect, useId, useState } from "react";

const MAX_PROJECT_NAME_LENGTH = 100;

interface ProjectNameDialogProps {
  mode: "create" | "edit";
  open: boolean;
  initialName?: string;
  initialDescription?: string;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: { name: string; description: string }) => void;
}

export function ProjectNameDialog({
  mode,
  open,
  initialName = "",
  initialDescription = "",
  isPending = false,
  onOpenChange,
  onSubmit,
}: ProjectNameDialogProps) {
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setDescription(initialDescription);
  }, [initialDescription, initialName, open]);

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
      onSubmit({ name: normalizedName, description: normalizedDescription });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新建工程" : "工程信息"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "创建一个包含主流程和 Lua 模块的编程工程。"
              : "修改工程名称和说明。"}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor={nameId}>工程名称</Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：CubeCat 智能巡线"
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
