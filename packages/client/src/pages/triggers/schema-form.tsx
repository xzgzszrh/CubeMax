import type { JsonSchema } from "@buildingai/services/web";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";

import { getSchemaFieldLabel } from "./schema";

type SchemaFormProps = {
  schema: JsonSchema;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  onJsonValidityChange?: (name: string, valid: boolean) => void;
};

function encodeOption(value: unknown): string {
  return JSON.stringify(value);
}

function decodeOption(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function JsonInput({
  name,
  schema,
  value,
  disabled,
  onChange,
  onValidityChange,
}: {
  name: string;
  schema: JsonSchema;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const fallback = schema.type === "array" ? [] : {};
  const [text, setText] = useState(() =>
    JSON.stringify(value ?? schema.default ?? fallback, null, 2),
  );
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(JSON.stringify(value ?? schema.default ?? fallback, null, 2));
    setInvalid(false);
    onValidityChange?.(true);
  }, [name]);

  return (
    <div>
      <Textarea
        value={text}
        disabled={disabled}
        className="min-h-28 font-mono text-xs"
        aria-invalid={invalid}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          try {
            const parsed = JSON.parse(next) as unknown;
            const valid =
              schema.type === "array"
                ? Array.isArray(parsed)
                : !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
            setInvalid(!valid);
            onValidityChange?.(valid);
            if (valid) onChange(parsed);
          } catch {
            setInvalid(true);
            onValidityChange?.(false);
          }
        }}
      />
      {invalid ? <p className="text-destructive mt-1 text-xs">请输入有效的 JSON</p> : null}
    </div>
  );
}

export function SchemaForm({
  schema,
  values,
  onChange,
  errors = {},
  disabled,
  onJsonValidityChange,
}: SchemaFormProps) {
  const fields = useMemo(() => Object.entries(schema.properties ?? {}), [schema]);
  const required = new Set(schema.required ?? []);

  if (!fields.length) {
    return (
      <div className="bg-muted/30 text-muted-foreground rounded-md border border-dashed px-4 py-8 text-center text-sm">
        此工程不需要传入参数
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {fields.map(([name, field]) => {
        const value = values[name] ?? field.default;
        const label = getSchemaFieldLabel(name, field);
        const description = field.description?.trim();
        const setValue = (next: unknown) => onChange({ ...values, [name]: next });

        return (
          <div className="space-y-2" key={name}>
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor={`trigger-field-${name}`}>
                {label}
                {required.has(name) ? <span className="text-destructive ml-1">*</span> : null}
              </Label>
              {field.title && field.title !== name ? (
                <span className="text-muted-foreground font-mono text-[11px]">{name}</span>
              ) : null}
            </div>

            {Array.isArray(field.enum) && field.enum.length ? (
              <Select
                value={value === undefined ? undefined : encodeOption(value)}
                disabled={disabled}
                onValueChange={(next) => setValue(decodeOption(next))}
              >
                <SelectTrigger id={`trigger-field-${name}`} className="w-full">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  {field.enum.map((option) => (
                    <SelectItem value={encodeOption(option)} key={encodeOption(option)}>
                      {String(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === "boolean" ? (
              <div className="flex h-10 items-center justify-between rounded-md border px-3">
                <span className="text-muted-foreground text-sm">{value ? "开启" : "关闭"}</span>
                <Switch
                  id={`trigger-field-${name}`}
                  checked={Boolean(value)}
                  disabled={disabled}
                  onCheckedChange={setValue}
                />
              </div>
            ) : field.type === "integer" || field.type === "number" ? (
              <Input
                id={`trigger-field-${name}`}
                type="number"
                step={field.type === "integer" ? 1 : "any"}
                value={typeof value === "number" ? value : ""}
                disabled={disabled}
                placeholder={field.default === undefined ? "请输入数字" : undefined}
                onChange={(event) => {
                  const next = event.target.value;
                  setValue(next === "" ? undefined : Number(next));
                }}
              />
            ) : field.type === "object" || field.type === "array" ? (
              <JsonInput
                name={name}
                schema={field}
                value={value}
                disabled={disabled}
                onChange={setValue}
                onValidityChange={(valid) => onJsonValidityChange?.(name, valid)}
              />
            ) : field.format === "textarea" || field.format === "multiline" ? (
              <Textarea
                id={`trigger-field-${name}`}
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                className="min-h-24"
                placeholder="请输入内容"
                onChange={(event) => setValue(event.target.value)}
              />
            ) : (
              <Input
                id={`trigger-field-${name}`}
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                placeholder="请输入内容"
                onChange={(event) => setValue(event.target.value)}
              />
            )}

            {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
            {errors[name] ? <p className="text-destructive text-xs">{errors[name]}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
