/**
 * Webhook 节点表单 - 配置回传端点
 * 为 xiaozhi.me 设备生成 MCP 调用指令
 */

import { Button, Divider, Input, Textarea } from "@douyinfe/semi-ui";
import { DisplayOutputs } from "@flowgram.ai/form-materials";
import type { FormMeta } from "@flowgram.ai/free-layout-editor";
import { Field } from "@flowgram.ai/free-layout-editor";
import { Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import {
  FormContent,
  FormHeader,
  FormItem,
  ReadonlyValue,
} from "../../form-components";
import { useIsSidebar, useNodeRenderContext } from "../../hooks";
import type { FlowNodeJSON } from "../../typings";
import { defaultFormMeta } from "../default-form-meta";

function ToolNameInput() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="toolName">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="工具名称" required type="string">
            <Input
              value={field.value ?? ""}
              onChange={(value) => field.onChange(value as string)}
              disabled={readonly}
              placeholder="例如: timer_complete, user_request"
              size="small"
              style={{ width: "100%" }}
            />
          </FormItem>
        ) : (
          <FormItem name="工具名称" type="string">
            <ReadonlyValue value={field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function ToolDescriptionInput() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<string> name="toolDescription">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="工具描述" type="string">
            <Textarea
              value={field.value ?? ""}
              onChange={(value) => field.onChange(value as string)}
              disabled={readonly}
              placeholder="描述这个回传端点的用途..."
              rows={2}
              style={{ width: "100%", resize: "none" }}
            />
          </FormItem>
        ) : (
          <FormItem name="工具描述" type="string">
            <ReadonlyValue value={field.value ?? "未设置"} />
          </FormItem>
        )
      }
    </Field>
  );
}

function generateXiaozhiPrompt(nodeData: any): string {
  const toolName = nodeData?.toolName || "[工具名称]";
  const description = nodeData?.toolDescription || "接收用户请求后的回传数据";
  const inputSchema = nodeData?.inputSchema;
  
  // 生成参数示例
  let paramExample = '{"action": "trigger", "data": {}}';
  if (inputSchema?.properties) {
    const props = inputSchema.properties;
    const exampleData: Record<string, any> = {};
    Object.keys(props).forEach(key => {
      const prop = props[key];
      if (prop.default !== undefined) {
        exampleData[key] = prop.default;
      } else if (prop.type === "string") {
        exampleData[key] = prop.title || key;
      } else if (prop.type === "number") {
        exampleData[key] = 0;
      } else if (prop.type === "boolean") {
        exampleData[key] = true;
      } else if (prop.type === "object") {
        exampleData[key] = {};
      }
    });
    if (Object.keys(exampleData).length > 0) {
      paramExample = JSON.stringify({ action: "trigger", ...exampleData }, null, 2);
    }
  }

  return `## MCP 工具调用规则

当用户提出以下请求时，必须调用 MCP 工具 "${toolName}"：

### 工具信息
- 工具名称: ${toolName}
- 描述: ${description}

### 调用时机
当用户请求计时、提醒、或者需要后台处理的请求时，立即调用此工具。

### 调用示例
\`\`\`json
{
  "tool": "${toolName}",
  "parameters": ${paramExample}
}
\`\`\`

### 注意事项
1. 只在用户明确提出相关请求时才调用
2. 调用后等待响应，不要重复调用
3. 收到响应后，根据结果向用户确认或继续对话`;
}

function WebhookPromptGenerator() {
  const isSidebar = useIsSidebar();
  const { nodeData } = useNodeRenderContext();
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const prompt = generateXiaozhiPrompt(nodeData);

  if (!isSidebar) {
    return (
      <FormItem name="xiaozhi.me 提示词" type="string">
        <ReadonlyValue value="查看侧边栏获取完整提示词" />
      </FormItem>
    );
  }

  return (
    <FormItem name="xiaozhi.me 提示词">
      <div style={{ 
        padding: "12px", 
        background: "#f8fafc", 
        borderRadius: "8px", 
        border: "1px solid #e2e8f0",
        fontSize: "12px" 
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ color: "#64748b", fontWeight: 500 }}>
            将以下内容添加到 xiaozhi.me 智能体提示词中：
          </div>
          <Button
            size="mini"
            icon={showAdvanced ? <EyeOff size={12} /> : <Eye size={12} />}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "收起" : "展开"}
          </Button>
        </div>
        
        <div style={{
          padding: "12px",
          background: "#fff",
          borderRadius: "6px",
          fontFamily: showAdvanced ? "inherit" : "monospace",
          fontSize: showAdvanced ? "13px" : "12px",
          whiteSpace: showAdvanced ? "pre-wrap" : "pre",
          wordBreak: "break-word",
          maxHeight: showAdvanced ? "400px" : "150px",
          overflow: "auto",
          border: "1px solid #e2e8f0",
          marginBottom: "12px",
        }}>
          {prompt}
        </div>
        
        <Button
          type="warning"
          icon={<Copy size={14} />}
          onClick={() => {
            navigator.clipboard.writeText(prompt);
          }}
          style={{ marginRight: "8px" }}
        >
          复制提示词
        </Button>
        
        {nodeData?.toolName && (
          <Button
            type="primary"
            icon={<Copy size={14} />}
            onClick={() => {
              navigator.clipboard.writeText(`使用工具 ${nodeData.toolName}`);
            }}
          >
            复制简短指令
          </Button>
        )}
      </div>
    </FormItem>
  );
}

function InputSchemaEditor() {
  const { readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  return (
    <Field<any> name="inputSchema">
      {({ field }) =>
        isSidebar ? (
          <FormItem name="参数 Schema" type="object">
            <Textarea
              value={JSON.stringify(field.value, null, 2)}
              onChange={(value) => {
                try {
                  field.onChange(JSON.parse(value as string));
                } catch {
                  // 忽略无效 JSON
                }
              }}
              disabled={readonly}
              placeholder='{"type": "object", "properties": {...}}'
              rows={4}
              style={{ width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: "12px" }}
            />
          </FormItem>
        ) : (
          <FormItem name="参数 Schema" type="object">
            <ReadonlyValue value={JSON.stringify(field.value, null, 2)} />
          </FormItem>
        )
      }
    </Field>
  );
}

export const renderForm = () => {
  return (
    <>
      <FormHeader />
      <FormContent>
        <ToolNameInput />
        <ToolDescriptionInput />
        <WebhookPromptGenerator />
        <Divider />
        <InputSchemaEditor />
        <Divider />
        <Field<any> name="outputs">
          {({ field }) => <DisplayOutputs value={field.value} />}
        </Field>
      </FormContent>
    </>
  );
};

export const formMeta: FormMeta<FlowNodeJSON> = {
  ...defaultFormMeta,
  render: renderForm,
  validate: {
    ...defaultFormMeta.validate,
    toolName: ({ value }: { value?: string }) =>
      value ? undefined : "请输入工具名称",
  },
};
