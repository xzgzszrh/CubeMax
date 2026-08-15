import { LOGIN_TYPE } from "@buildingai/constants/shared/auth";
import {
  UserTerminal,
  type UserTerminalType,
} from "@buildingai/constants/shared/status-codes.constant";
import {
  useCheckAccountMutation,
  useLoginMutation,
  useRegisterMutation,
} from "@buildingai/services/web";
import { useAuthStore, useConfigStore } from "@buildingai/stores";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@buildingai/ui/components/ui/card";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup } from "@buildingai/ui/components/ui/field";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@buildingai/ui/components/ui/form";
import { Input, PasswordInput } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { getDisplayAppName } from "@buildingai/ui/lib/brand";
import { cn } from "@buildingai/ui/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { AgreementDialog, type AgreementType } from "@/components/agreement-dialog";

const PageEnum = {
  ACCOUNT_INPUT: "account-input",
  PASSWORD: "password",
  REGISTER: "register",
} as const;

/** 教室大屏路由前缀，与 router 中的 `/board/:identifier/*` 对应。 */
const BOARD_PATH_PREFIX = "/board/";

const accountSchema = z.object({
  account: z.string().min(1, { message: "请输入账号" }),
});

const loginPasswordSchema = z.object({
  password: z.string().min(6, { message: "密码至少6位" }),
});

const registerFormSchema = z
  .object({
    username: z
      .string()
      .min(3, { message: "用户名至少3位" })
      .max(20, { message: "用户名最多20位" })
      .regex(/^[a-zA-Z0-9_]+$/, { message: "用户名只能包含字母、数字、下划线" }),
    password: z.string().min(6, { message: "密码至少6位" }),
    confirmPassword: z.string().min(6, { message: "确认密码至少6位" }),
    nickname: z.string().optional(),
    email: z.string().email({ message: "邮箱格式不正确" }).optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次密码不一致",
    path: ["confirmPassword"],
  });

type AccountFormValues = z.infer<typeof accountSchema>;
type LoginPasswordFormValues = z.infer<typeof loginPasswordSchema>;
type RegisterFormValues = z.infer<typeof registerFormSchema>;

const FormTitle: Record<string, { title: string; description: string }> = {
  [PageEnum.ACCOUNT_INPUT]: {
    title: "欢迎回来",
    description: "输入你的账号继续登录",
  },
  [PageEnum.PASSWORD]: {
    title: "欢迎回来",
    description: "输入你的密码",
  },
  [PageEnum.REGISTER]: {
    title: "创建账号",
    description: "使用用户名和密码注册",
  },
};

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const [page, setPage] = useState<string>(PageEnum.ACCOUNT_INPUT);
  const [checkResult, setCheckResult] = useState<{ account: string } | null>(null);
  const { confirm } = useAlertDialog();
  const { setToken } = useAuthStore((state) => state.authActions);
  const { websiteConfig } = useConfigStore((state) => state.config);
  const appName = getDisplayAppName(websiteConfig?.webinfo.name);
  const [agree, setAgree] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [activeAgreement, setActiveAgreement] = useState<AgreementType>("service");
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect =
    (location.state as { redirect?: string })?.redirect ?? searchParams.get("redirect") ?? "";

  /**
   * 登录终端。教室大屏（`/board/...`）走 SCREEN，其余走 PC。
   *
   * 这不只是统计口径：服务端撤销旧令牌时按终端分桶，老师在大屏上登录自己的
   * 账号会落进 SCREEN 桶，因此不会踢掉他电脑上的控制台会话 —— 即便管理员
   * 关掉了"允许多处登录"。终端直接从跳转目标推导，不额外传标记，免得两处失配。
   */
  const terminal: UserTerminalType = redirect.startsWith(BOARD_PATH_PREFIX)
    ? UserTerminal.SCREEN
    : UserTerminal.PC;

  const handleRedirect = useCallback(
    (path: string, token?: string) => {
      const isPluginPath = path.includes("/extension/");

      if (isPluginPath && import.meta.env.DEV && token) {
        const encodedToken = btoa(token);
        const url = new URL(path, window.location.origin);
        url.searchParams.set("_t", encodedToken);
        window.location.replace(url.toString());
      } else if (path.startsWith("http")) {
        window.location.replace(path);
      } else if (isPluginPath) {
        window.location.replace(path);
      } else {
        navigate(path, { replace: true });
      }
    },
    [navigate],
  );

  const loginSettings = websiteConfig?.loginSettings;
  const allowAccountLogin =
    loginSettings?.allowedLoginMethods?.includes(LOGIN_TYPE.ACCOUNT) ?? true;
  const allowAccountRegister =
    loginSettings?.allowedRegisterMethods?.includes(LOGIN_TYPE.ACCOUNT) ?? true;
  const canUseAccountInput = allowAccountLogin;
  const showPolicyAgreement = loginSettings?.showPolicyAgreement ?? true;
  const loginError = searchParams.get("error");
  const accountLoginLabel = "账号";
  const accountLoginPlaceholder = "请输入账号";

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { account: "" },
  });

  const passwordForm = useForm<LoginPasswordFormValues>({
    resolver: zodResolver(loginPasswordSchema),
    defaultValues: { password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      nickname: "",
      email: "",
    },
  });

  const { mutateAsync: checkAccount, isPending: isCheckPending } = useCheckAccountMutation();
  const { mutateAsync: login, isPending: isLoginPending } = useLoginMutation();
  const { mutateAsync: register, isPending: isRegisterPending } = useRegisterMutation();

  useEffect(() => {
    if (page === PageEnum.REGISTER && !allowAccountRegister) {
      setPage(PageEnum.ACCOUNT_INPUT);
    }
  }, [allowAccountRegister, page]);

  const handleOpenAgreement = useCallback((type: AgreementType) => {
    setActiveAgreement(type);
    setAgreementOpen(true);
  }, []);

  const renderAgreementTrigger = (checkboxId: string) => (
    <span className="flex flex-wrap items-center gap-1">
      <Label htmlFor={checkboxId}>我已阅读并同意</Label>
      <button
        type="button"
        className="text-primary underline-offset-4 hover:underline"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleOpenAgreement("service");
        }}
      >
        《用户协议》
      </button>
      <span>和</span>
      <button
        type="button"
        className="text-primary underline-offset-4 hover:underline"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleOpenAgreement("privacy");
        }}
      >
        《隐私政策》
      </button>
    </span>
  );

  const ensureAgreed = async () => {
    if (!showPolicyAgreement || agree) return true;
    try {
      await confirm({
        title: "服务协议及隐私保护",
        description: (
          <span>
            确认即表示你已阅读并同意{appName}的
            <button
              type="button"
              className="text-primary inline underline-offset-4 hover:underline"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleOpenAgreement("service");
              }}
            >
              《用户协议》
            </button>
            和
            <button
              type="button"
              className="text-primary inline underline-offset-4 hover:underline"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleOpenAgreement("privacy");
              }}
            >
              《隐私政策》
            </button>
          </span>
        ),
        onConfirm: () => setAgree(true),
      });
      return true;
    } catch {
      return false;
    }
  };

  const onAccountNext = async (values: AccountFormValues) => {
    const res = await checkAccount({ account: values.account });
    if (!res.hasAccount) {
      accountForm.setError("account", {
        message: allowAccountRegister ? "账号不存在，请先注册" : "账号不存在",
      });
      return;
    }

    if (!allowAccountLogin) {
      accountForm.setError("account", { message: "账号密码登录未开启" });
      return;
    }

    if (!res.hasPassword) {
      accountForm.setError("account", {
        message: "该账号未设置密码，无法使用账号密码登录",
      });
      return;
    }

    setCheckResult({ account: values.account });
    passwordForm.reset();
    setPage(PageEnum.PASSWORD);
  };

  const onPasswordSubmit = async (values: LoginPasswordFormValues) => {
    if (!checkResult) return;
    const agreed = await ensureAgreed();
    if (!agreed) return;
    const data = await login({
      username: checkResult.account,
      password: values.password,
      terminal,
    });
    setToken(data.token);
    handleRedirect(redirect || "/", data.token);
  };

  const onRegisterSubmit = async (values: RegisterFormValues) => {
    const agreed = await ensureAgreed();
    if (!agreed) return;
    const data = await register({
      username: values.username,
      password: values.password,
      confirmPassword: values.confirmPassword,
      terminal,
      ...(values.nickname && { nickname: values.nickname }),
      ...(values.email && { email: values.email }),
    });
    setToken(data.token);
    handleRedirect(redirect || "/", data.token);
  };

  const renderAccountStep = () => (
    <Form {...accountForm}>
      <form onSubmit={accountForm.handleSubmit(onAccountNext)}>
        <FieldGroup className="gap-5">
          {canUseAccountInput && (
            <>
              <FormField
                control={accountForm.control}
                name="account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{accountLoginLabel}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={accountLoginPlaceholder}
                        {...field}
                        autoComplete="username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Field>
                <Button type="submit" className="w-full" loading={isCheckPending}>
                  下一步 <ArrowRight />
                </Button>
                <FieldDescription className="text-center">
                  {allowAccountRegister ? (
                    <>
                      还没有账号？{""}
                      <button
                        type="button"
                        className="text-primary underline-offset-4 hover:underline"
                        onClick={() => setPage(PageEnum.REGISTER)}
                      >
                        注册
                      </button>
                    </>
                  ) : null}
                </FieldDescription>
              </Field>
            </>
          )}
        </FieldGroup>
      </form>
    </Form>
  );

  const renderPasswordStep = () => (
    <Form {...passwordForm}>
      <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
        <FieldGroup className="gap-5">
          <FormField
            control={passwordForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>密码</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="请输入密码"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {showPolicyAgreement && (
            <Field>
              <FieldDescription>
                <span className="flex items-center gap-3">
                  <Checkbox
                    checked={agree}
                    onCheckedChange={(e) => setAgree(e as boolean)}
                    id="terms-login"
                  />
                  {renderAgreementTrigger("terms-login")}
                </span>
              </FieldDescription>
            </Field>
          )}
          <Field>
            <Button type="submit" className="w-full" loading={isLoginPending}>
              登录 <ArrowRight />
            </Button>
            <FieldDescription className="text-center">
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setPage(PageEnum.ACCOUNT_INPUT);
                  setCheckResult(null);
                }}
              >
                使用其他账号
              </button>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </Form>
  );

  const renderRegisterStep = () => (
    <Form {...registerForm}>
      <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)}>
        <FieldGroup className="gap-5">
          <FormField
            control={registerForm.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>用户名</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="3-20位字母、数字、下划线"
                    {...field}
                    autoComplete="username"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={registerForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={registerForm.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>确认密码</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={registerForm.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>昵称（选填）</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="昵称" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={registerForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>邮箱（选填）</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="m@example.com" {...field} autoComplete="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {showPolicyAgreement && (
            <Field>
              <FieldDescription>
                <span className="flex items-center gap-3">
                  <Checkbox
                    checked={agree}
                    onCheckedChange={(e) => setAgree(e as boolean)}
                    id="terms-register"
                  />
                  {renderAgreementTrigger("terms-register")}
                </span>
              </FieldDescription>
            </Field>
          )}
          <Field>
            <Button type="submit" className="w-full" loading={isRegisterPending}>
              注册 <ArrowRight />
            </Button>
            <FieldDescription className="text-center">
              已有账号？{" "}
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => setPage(PageEnum.ACCOUNT_INPUT)}
              >
                登录
              </button>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </Form>
  );

  const titleConfig = FormTitle[page] ?? FormTitle[PageEnum.ACCOUNT_INPUT];

  return (
    <>
      <div className={cn("flex flex-col gap-4", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{titleConfig.title}</CardTitle>
            <CardDescription>{titleConfig.description}</CardDescription>
            {loginError && (
              <p className="text-destructive text-sm">
                {loginError === "missing_code"
                  ? "授权未完成"
                  : loginError === "config"
                    ? "登录配置异常"
                    : loginError === "token_exchange" || loginError === "no_access_token"
                      ? "授权验证失败"
                      : loginError === "userinfo"
                        ? "获取用户信息失败"
                        : "登录失败，请重试"}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {page === PageEnum.ACCOUNT_INPUT && renderAccountStep()}
            {page === PageEnum.PASSWORD && renderPasswordStep()}
            {page === PageEnum.REGISTER && renderRegisterStep()}
          </CardContent>
        </Card>
      </div>
      <AgreementDialog
        open={agreementOpen}
        onOpenChange={setAgreementOpen}
        type={activeAgreement}
      />
    </>
  );
}
