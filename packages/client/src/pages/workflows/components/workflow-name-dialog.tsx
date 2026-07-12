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
import { type FormEvent, useEffect, useId, useState } from "react";

const MAX_WORKFLOW_NAME_LENGTH = 100;

interface WorkflowNameDialogProps {
  mode: "create" | "rename";
  open: boolean;
  initialName?: string;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}

export function WorkflowNameDialog({
  mode,
  open,
  initialName = "",
  isPending = false,
  onOpenChange,
  onSubmit,
}: WorkflowNameDialogProps) {
  const inputId = useId();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [initialName, open]);

  const normalizedName = name.trim();
  const isUnchanged = mode === "rename" && normalizedName === initialName.trim();
  const canSubmit = normalizedName.length > 0 && !isUnchanged && !isPending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmit(normalizedName);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新建工作流" : "重命名工作流"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "为新的工作流设置一个名称。" : "修改工作流名称。"}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor={inputId}>工作流名称</Label>
            <Input
              id={inputId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="请输入工作流名称"
              maxLength={MAX_WORKFLOW_NAME_LENGTH}
              autoFocus
              disabled={isPending}
            />
            <p className="text-muted-foreground text-right text-xs">
              {name.length}/{MAX_WORKFLOW_NAME_LENGTH}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" loading={isPending} disabled={!canSubmit}>
              {mode === "create" ? "创建" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
