/**
 * Webhook 节点 - 自定义回传 MCP 节点
 * 用于定义一个可被 xiaozhi.me 调用的 MCP 工具，接收回传数据
 * 这是与应用工作流通信的核心机制
 */

import { nanoid } from "nanoid";

import iconWebhook from "../../assets/icon-webhook.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const WebhookNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Webhook,
  info: {
    icon: iconWebhook,
    description: "定义一个可被调用的 MCP 端点，xiaozhi.me 通过它回传数据。",
  },
  meta: {
    nodePanelLabel: "回传端点",
    nodePanelGroup: "app",
    nodePanelGroupLabel: "智能交互",
    size: { width: 380, height: 480 },
    defaultPorts: [
      { type: "output", label: "收到数据" },
      { type: "output", label: "错误" },
    ],
  },
  onAdd() {
    return {
      id: `webhook_${nanoid(5)}`,
      type: WorkflowNodeType.Webhook,
      data: {
        title: `回传端点_${++index}`,
        // MCP 工具名称
        toolName: "",
        // MCP 工具描述
        toolDescription: "",
        // 输入参数 schema（JSON Schema 格式）
        inputSchema: {
          type: "object",
          properties: {
            data: {
              type: "object",
              title: "回传数据",
              description: "从 xiaozhi.me 回传的数据",
            },
            action: {
              type: "string",
              title: "动作类型",
              description: "标识用户执行的动作",
            },
          },
          required: ["data"],
        },
        // 输入值
        inputs: {
          type: "object",
          properties: {
            data: { type: "object", title: "回传数据" },
            action: { type: "string", title: "动作类型" },
          },
        },
        inputsValues: {
          data: { type: "ref", content: [] },
          action: { type: "ref", content: [] },
        },
        // 输出定义
        outputs: {
          type: "object",
          properties: {
            received: {
              type: "boolean",
              title: "已收到",
              description: "是否成功接收回传数据",
            },
            data: {
              type: "object",
              title: "回传数据",
              description: "接收到的完整数据",
            },
            action: {
              type: "string",
              title: "动作",
              description: "用户执行的动作标识",
            },
            timestamp: {
              type: "number",
              title: "时间戳",
              description: "回传时间",
            },
          },
        },
      },
    };
  },
  formMeta,
};
