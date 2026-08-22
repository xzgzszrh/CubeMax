import { useMobileInstallationsQuery } from "@buildingai/services/web";
import { Divider, InputNumber, Select, Switch } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";

import {
  FormContent,
  FormHeader,
  FormItem,
  ReadonlyValue,
} from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { FlowNodeJSON } from "../../typings";
import { defaultFormMeta } from "../default-form-meta";

const BINDING_OPTIONS = [
  { value: "triggering_device", label: "从这台 CubeMax 启动时使用本机" },
  { value: "specific", label: "指定一台已登录的手机" },
];

const FACING_OPTIONS = [
  { value: "back", label: "后置" },
  { value: "front", label: "前置" },
];

const RESOLUTION_OPTIONS = [
  { value: "720p", label: "720p（长边 1280）" },
  { value: "1080p", label: "1080p（长边 1920）" },
  { value: "native", label: "设备原始（仍受大小上限）" },
];

const OPEN_OPTIONS = [
  { value: "workflow_start", label: "工作流启动时打开" },
  { value: "node_enter", label: "执行到本节点时打开" },
];

function SelectField({
  name,
  label,
  options,
  required,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  return (
    <Field<string> name={name}>
      {({ field }) =>
        isSidebar ? (
          <FormItem name={label} required={required} type="string">
            <Select
              value={field.value}
              disabled={readonly}
              onChange={(value) => field.onChange(value as string)}
              size="small"
              style={{ width: "100%" }}
            >
              {options.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </FormItem>
        ) : (
          <FormItem name={label} type="string">
            <ReadonlyValue
              value={options.find((item) => item.value === field.value)?.label ?? field.value ?? "未设置"}
            />
          </FormItem>
        )
      }
    </Field>
  );
}

function InstallationSelect() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  const { data, isLoading } = useMobileInstallationsQuery();
  const items = data?.items ?? [];
  return (
    <Field<string> name="deviceBinding">
      {({ field: binding }) =>
        binding.value !== "specific" ? null : (
          <Field<string> name="installationId">
            {({ field }) =>
              isSidebar ? (
                <FormItem name="拍摄设备" required type="string">
                  <Select
                    value={field.value}
                    disabled={readonly || isLoading}
                    placeholder={isLoading ? "加载中..." : "选择已登录的 CubeMax"}
                    emptyContent="暂无在线或已登记的手机，请先用 CubeMax 登录"
                    optionList={items.map((item) => ({
                      label: `${item.device_model || "iPhone"} · ${item.installation_id.slice(0, 8)}${item.online ? "（在线）" : ""}`,
                      value: item.installation_id,
                    }))}
                    onChange={(value) => field.onChange(value as string)}
                    size="small"
                    style={{ width: "100%" }}
                  />
                </FormItem>
              ) : (
                <FormItem name="拍摄设备" type="string">
                  <ReadonlyValue value={field.value || "未指定"} />
                </FormItem>
              )
            }
          </Field>
        )
      }
    </Field>
  );
}

function NumberField({
  name,
  label,
  min,
  max,
  step,
  hint,
}: {
  name: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  hint?: string;
}) {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  return (
    <Field<number> name={name}>
      {({ field }) =>
        isSidebar ? (
          <FormItem name={label} type="number">
            <InputNumber
              value={field.value}
              disabled={readonly}
              min={min}
              max={max}
              step={step}
              onChange={(value) => field.onChange(Number(value))}
              style={{ width: "100%" }}
            />
            {hint ? <div style={{ fontSize: 12, color: "var(--semi-color-text-2)", marginTop: 4 }}>{hint}</div> : null}
          </FormItem>
        ) : (
          <FormItem name={label} type="number">
            <ReadonlyValue value={String(field.value ?? "")} />
          </FormItem>
        )
      }
    </Field>
  );
}

function SwitchField({ name, label }: { name: string; label: string }) {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();
  return (
    <Field<boolean> name={name}>
      {({ field }) =>
        isSidebar ? (
          <FormItem name={label} type="boolean">
            <Switch checked={!!field.value} disabled={readonly} onChange={(checked) => field.onChange(checked)} size="small" />
          </FormItem>
        ) : (
          <FormItem name={label} type="boolean">
            <ReadonlyValue value={field.value ? "是" : "否"} />
          </FormItem>
        )
      }
    </Field>
  );
}

export const renderForm = () => (
  <>
    <FormHeader />
    <FormContent>
      <SelectField name="deviceBinding" label="拍摄目标" options={BINDING_OPTIONS} required />
      <InstallationSelect />
      <SelectField name="openCameraOn" label="打开时机" options={OPEN_OPTIONS} />
      <SelectField name="facingDefault" label="默认镜头" options={FACING_OPTIONS} />
      <SwitchField name="allowSwitchFacing" label="允许切换前后摄像头" />
      <SelectField name="resolution" label="分辨率" options={RESOLUTION_OPTIONS} />
      <NumberField name="jpegQuality" label="JPEG 质量" min={0.5} max={0.95} step={0.05} />
      <NumberField
        name="consentTimeoutMs"
        label="授权/在线等待（毫秒）"
        min={10000}
        max={120000}
        step={1000}
        hint="从弹出授权到预览就绪"
      />
      <NumberField
        name="previewMaxMs"
        label="预览安全帽（毫秒）"
        min={0}
        max={1800000}
        step={1000}
        hint="0 表示只随工作流结束关闭"
      />
      <NumberField
        name="timeoutMs"
        label="拍照超时（毫秒）"
        min={5000}
        max={120000}
        step={1000}
        hint="从拍照指令到上传成功，不是从打开相机算起"
      />
      <NumberField name="imageUrlTtlSec" label="签名 URL 有效期（秒）" min={300} max={86400} step={60} />
      <NumberField name="captureDelayMs" label="拍照前等待（毫秒）" min={0} max={10000} step={100} hint="预览就绪后再等待" />
      <Divider />
      <Field<any> name="outputs">{({ field }) => <DisplayOutputs value={field.value} />}</Field>
    </FormContent>
  </>
);

export const formMeta: FormMeta<FlowNodeJSON> = {
  ...defaultFormMeta,
  render: renderForm,
};
