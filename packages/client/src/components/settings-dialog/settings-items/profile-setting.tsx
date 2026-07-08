import { uploadFileAuto, useUserInfoQuery } from "@buildingai/services/shared";
import {
  type AllowedUserField,
  useChangePasswordMutation,
  useUpdateUserFieldMutation,
} from "@buildingai/services/web";
import { useAuthStore } from "@buildingai/stores";
import { RootOnly } from "@buildingai/ui/components/auth/root-only";
import { CopyButton } from "@buildingai/ui/components/copy-button";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Input, PasswordInput } from "@buildingai/ui/components/ui/input";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { Check, Loader2, PenLine, User, X } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SettingItem, SettingItemAction, SettingItemGroup } from "../setting-item";

const ProfileSetting = () => {
  const { isLogin, logout } = useAuthStore((state) => state.authActions);
  const { data } = useUserInfoQuery();

  const [editingField, setEditingField] = useState<AllowedUserField | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const { mutate: updateField, isPending } = useUpdateUserFieldMutation();

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { mutate: changePassword, isPending: isChangePasswordPending } = useChangePasswordMutation({
    onSuccess: async () => {
      toast.success("密码已修改，请重新登录");
      setPasswordDialogOpen(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await logout();
      window.location.replace("/login");
    },
    onError: (e) => {
      toast.error(e.message || "修改密码失败");
    },
  });

  const handleChangePasswordSubmit = useCallback(() => {
    if (!oldPassword.trim()) {
      toast.error("请输入当前密码");
      return;
    }
    if (!newPassword.trim()) {
      toast.error("请输入新密码");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword)) {
      toast.error("新密码须同时包含字母和数字");
      return;
    }
    changePassword({
      oldPassword: oldPassword.trim(),
      newPassword: newPassword.trim(),
      confirmPassword: confirmPassword.trim(),
    });
  }, [oldPassword, newPassword, confirmPassword, changePassword]);

  const handleAvatarClick = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const handleAvatarChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingAvatar(true);
      try {
        const result = await uploadFileAuto(file, { description: "avatar" });
        updateField(
          { field: "avatar", value: result.url },
          {
            onSuccess: () => {
              toast.success("头像已更新");
            },
            onSettled: () => {
              setIsUploadingAvatar(false);
              if (avatarInputRef.current) {
                avatarInputRef.current.value = "";
              }
            },
          },
        );
      } catch {
        toast.error("头像上传失败");
        setIsUploadingAvatar(false);
        if (avatarInputRef.current) {
          avatarInputRef.current.value = "";
        }
      }
    },
    [updateField],
  );

  const handleStartEdit = useCallback((field: AllowedUserField, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || "");
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue("");
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingField) return;

    updateField(
      { field: editingField, value: editValue },
      {
        onSuccess: () => {
          setEditingField(null);
          setEditValue("");
        },
      },
    );
  }, [editingField, editValue, updateField]);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  return (
    <div className="flex flex-col gap-4">
      <SettingItemGroup label="基本信息">
        <SettingItem
          title={
            <Avatar className="size-10 rounded-lg after:rounded-lg">
              {isLogin() && (
                <AvatarImage className="rounded-lg" src={data?.avatar} alt={data?.nickname} />
              )}
              <AvatarFallback className="rounded-lg">
                {isLogin() ? data?.nickname?.slice(0, 1) : <User />}
              </AvatarFallback>
            </Avatar>
          }
        >
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <SettingItemAction onClick={handleAvatarClick} disabled={isUploadingAvatar}>
            {isUploadingAvatar ? <Loader2 className="animate-spin" /> : <PenLine />}
          </SettingItemAction>
        </SettingItem>
        <SettingItem
          title={
            editingField === "nickname" ? (
              <Input
                ref={inputRef}
                className="h-5 w-full rounded-none border-0 border-none bg-transparent! px-0 shadow-none ring-0 focus-within:ring-0 focus-visible:ring-0"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                disabled={isPending}
              />
            ) : (
              data?.nickname
            )
          }
          description="昵称"
        >
          {editingField === "nickname" ? (
            <div className="flex items-center gap-1">
              <SettingItemAction onClick={handleSaveEdit} disabled={isPending}>
                <Check />
              </SettingItemAction>
              <SettingItemAction onClick={handleCancelEdit} disabled={isPending}>
                <X />
              </SettingItemAction>
            </div>
          ) : (
            <SettingItemAction onClick={() => handleStartEdit("nickname", data?.nickname || "")}>
              <PenLine />
            </SettingItemAction>
          )}
        </SettingItem>
        <SettingItem title={data?.username} description="用户名">
          <SettingItemAction asChild>
            <CopyButton value={data?.username ?? ""} />
          </SettingItemAction>
        </SettingItem>
        <SettingItem title={data?.userNo} description="用户编号">
          <SettingItemAction asChild>
            <CopyButton value={data?.userNo ?? ""} />
          </SettingItemAction>
        </SettingItem>
        <SettingItem
          title={
            editingField === "email" ? (
              <Input
                ref={inputRef}
                className="h-5 w-full rounded-none border-0 border-none bg-transparent! px-0 shadow-none ring-0 focus-within:ring-0 focus-visible:ring-0"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                disabled={isPending}
              />
            ) : (
              data?.email || "--"
            )
          }
          description="邮箱"
        >
          {editingField === "email" ? (
            <div className="flex items-center gap-1">
              <SettingItemAction onClick={handleSaveEdit} disabled={isPending}>
                <Check />
              </SettingItemAction>
              <SettingItemAction onClick={handleCancelEdit} disabled={isPending}>
                <X />
              </SettingItemAction>
            </div>
          ) : (
            <SettingItemAction onClick={() => handleStartEdit("email", data?.email || "")}>
              <PenLine />
            </SettingItemAction>
          )}
        </SettingItem>
      </SettingItemGroup>

      <SettingItemGroup label="安全设置">
        <SettingItem title={data?.hasPassword ? "已设置" : "未设置"} description="密码">
          {data?.hasPassword && (
            <SettingItemAction onClick={() => setPasswordDialogOpen(true)}>
              <PenLine />
            </SettingItemAction>
          )}
        </SettingItem>
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>修改密码</DialogTitle>
              <DialogDescription>
                修改成功后将退出登录，请使用新密码重新登录。新密码须至少 6 位且包含字母和数字。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-muted-foreground text-sm font-medium">当前密码</label>
                <PasswordInput
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="请输入当前密码"
                  autoComplete="current-password"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-muted-foreground text-sm font-medium">新密码</label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 位，含字母和数字"
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-muted-foreground text-sm font-medium">确认新密码</label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPasswordDialogOpen(false)}
                  disabled={isChangePasswordPending}
                >
                  取消
                </Button>
                <Button onClick={handleChangePasswordSubmit} loading={isChangePasswordPending}>
                  确认修改
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <RootOnly reverse>
          <SettingItem title="注销账号" description="您的账号数据将会被永久删除，此操作不可逆">
            <SettingItemAction variant="destructive" size="sm">
              注销
            </SettingItemAction>
          </SettingItem>
        </RootOnly>
      </SettingItemGroup>

      <SettingItemGroup label="注册信息">
        <SettingItem
          title={<TimeText value={data?.lastLoginAt} format="YYYY/MM/DD HH:mm" />}
          description="最后登录时间"
        />
        <SettingItem
          title={<TimeText value={data?.createdAt} format="YYYY/MM/DD HH:mm" />}
          description="注册时间"
        />
      </SettingItemGroup>
    </div>
  );
};

export { ProfileSetting };
