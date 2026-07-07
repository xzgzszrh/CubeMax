import { BooleanNumber } from "@buildingai/constants/shared/status-codes.constant";
import {
  type CreateAiModelDto,
  type CreateAiProviderDto,
  type SecretTemplate,
  useAllSecretTemplatesQuery,
  useCreateAiModelMutation,
  useCreateAiProviderMutation,
  useCreateSecretMutation,
} from "@buildingai/services/console";
import { Alert, AlertDescription } from "@buildingai/ui/components/ui/alert";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@buildingai/ui/components/ui/form";
import { Input } from "@buildingai/ui/components/ui/input";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  modelId: z
    .string({ message: "模型 ID 必须填写" })
    .trim()
    .min(1, "模型 ID 不能为空")
    .max(100, "模型 ID 不能超过100个字符"),
  modelName: z.string().trim().max(100, "模型名称不能超过100个字符").optional(),
  providerName: z.string().trim().max(100, "配置名称不能超过100个字符").optional(),
  providerCode: z
    .string()
    .trim()
    .max(50, "供应商标识不能超过50个字符")
    .regex(/^[a-zA-Z0-9_-]*$/, "仅支持字母、数字、下划线和短横线")
    .optional(),
  baseUrl: z.string({ message: "Base URL 必须填写" }).trim().url("请输入有效的 Base URL"),
  apiKey: z.string({ message: "API Key 必须填写" }).trim().min(1, "API Key 不能为空"),
  maxContext: z.number().int().min(1, "最大上下文条数不能小于 1"),
  power: z.number().int().min(0, "计费积分不能小于 0"),
  description: z.string().trim().max(500, "描述不能超过500个字符").optional(),
});

type FormValues = z.infer<typeof formSchema>;

type WorkflowModelFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProviderCodes?: string[];
  onSuccess?: () => void;
};

function findOpenAICompatibleTemplate(templates?: SecretTemplate[]) {
  return templates?.find((template) => {
    if (template.isEnabled !== BooleanNumber.YES) return false;
    const fieldNames = new Set(template.fieldConfig?.map((field) => field.name.toLowerCase()));
    return fieldNames.has("baseurl") && fieldNames.has("apikey");
  });
}

function buildProviderCode(modelId: string) {
  const slug = modelId
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return `workflow-${slug || "model"}`;
}

function buildSecretFieldValues(template: SecretTemplate, values: FormValues) {
  return template.fieldConfig.map((field) => {
    const fieldName = field.name.toLowerCase();
    let value = "";

    if (fieldName === "baseurl") {
      value = values.baseUrl;
    } else if (fieldName === "apikey") {
      value = values.apiKey;
    }

    return {
      name: field.name,
      value,
    };
  });
}

export function WorkflowModelFormDialog({
  open,
  onOpenChange,
  existingProviderCodes = [],
  onSuccess,
}: WorkflowModelFormDialogProps) {
  const { data: secretTemplates } = useAllSecretTemplatesQuery({ enabled: open });
  const secretTemplate = useMemo(
    () => findOpenAICompatibleTemplate(secretTemplates),
    [secretTemplates],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema as any),
    defaultValues: {
      modelId: "",
      modelName: "",
      providerName: "",
      providerCode: "",
      baseUrl: "",
      apiKey: "",
      maxContext: 3,
      power: 0,
      description: "",
    },
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      modelId: "",
      modelName: "",
      providerName: "",
      providerCode: "",
      baseUrl: "",
      apiKey: "",
      maxContext: 3,
      power: 0,
      description: "",
    });
  }, [form, open]);

  const createSecretMutation = useCreateSecretMutation();
  const createProviderMutation = useCreateAiProviderMutation();
  const createModelMutation = useCreateAiModelMutation();

  const isPending =
    createSecretMutation.isPending ||
    createProviderMutation.isPending ||
    createModelMutation.isPending;

  const handleSubmit = async (values: FormValues) => {
    if (!secretTemplate) {
      toast.error("没有可用的 OpenAI 兼容密钥模板");
      return;
    }

    const modelId = values.modelId.trim();
    const modelName = values.modelName?.trim() || modelId;
    const providerName = values.providerName?.trim() || modelName;
    const providerCode = values.providerCode?.trim() || buildProviderCode(modelId);

    if (existingProviderCodes.includes(providerCode)) {
      form.setError("providerCode", {
        message: "供应商标识已存在，请填写一个新的标识",
      });
      toast.error("供应商标识已存在");
      return;
    }

    try {
      const secret = await createSecretMutation.mutateAsync({
        name: `${providerName} / ${modelId}`,
        templateId: secretTemplate.id,
        fieldValues: buildSecretFieldValues(secretTemplate, values),
        status: BooleanNumber.YES,
      });

      const providerDto: CreateAiProviderDto = {
        provider: providerCode,
        name: providerName,
        bindSecretId: secret.id,
        supportedModelTypes: ["llm"],
        isActive: true,
        description: values.description || undefined,
        sortOrder: 0,
      };
      const provider = await createProviderMutation.mutateAsync(providerDto);

      const modelDto: CreateAiModelDto = {
        name: modelName,
        providerId: provider.id,
        model: modelId,
        modelType: "llm",
        maxContext: values.maxContext,
        features: [],
        billingRule: {
          power: values.power,
          tokens: 1000,
        },
        membershipLevel: [],
        isActive: true,
        thinking: false,
        enableThinkingParam: false,
        isDefault: false,
        description: values.description || undefined,
        sortOrder: 0,
      };
      await createModelMutation.mutateAsync(modelDto);

      toast.success("工作流模型配置已创建");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建失败";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="p-4">
          <DialogTitle>配置工作流模型</DialogTitle>
          <DialogDescription>创建一个可在工作流 LLM 节点中选择的模型</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 p-4 pt-0 pb-17">
              {!secretTemplate && (
                <Alert>
                  <Info />
                  <AlertDescription>
                    需要先启用包含 baseUrl 和 apiKey 字段的密钥模板。
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="modelId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>模型 ID</FormLabel>
                    <FormControl>
                      <Input placeholder="例如: gpt-4o, deepseek-chat" {...field} />
                    </FormControl>
                    <FormDescription>工作流节点中展示的模型标识</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Base URL</FormLabel>
                    <FormControl>
                      <Input placeholder="例如: https://api.openai.com/v1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>API Key</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="new-password"
                        placeholder="请输入模型服务 API Key"
                        type="password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="modelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>显示名称</FormLabel>
                      <FormControl>
                        <Input placeholder="默认使用模型 ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="providerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>配置名称</FormLabel>
                      <FormControl>
                        <Input placeholder="默认使用显示名称" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="providerCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>供应商标识</FormLabel>
                    <FormControl>
                      <Input placeholder="不填则根据模型 ID 自动生成" {...field} />
                    </FormControl>
                    <FormDescription>同一个后台中必须唯一</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="maxContext"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>最大上下文条数</FormLabel>
                      <FormControl>
                        <Input
                          min={1}
                          type="number"
                          value={field.value}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="power"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>计费积分</FormLabel>
                      <FormControl>
                        <Input
                          min={0}
                          type="number"
                          value={field.value}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea className="resize-none" placeholder="可选" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="bg-background absolute bottom-0 left-0 w-full flex-row justify-end rounded-lg p-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={isPending || !secretTemplate}>
                  {isPending && <Loader2 className="animate-spin" />}
                  创建
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
