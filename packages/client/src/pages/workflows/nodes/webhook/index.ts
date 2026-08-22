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
    description: "向 CubeCat 注册一个回传工具，收到调用后带着数据继续往下走。",
  },
  meta: {
    nodePanelLabel: "回传端点",
    nodePanelGroup: "app",
    nodePanelGroupLabel: "智能交互",
    size: { width: 380, height: 500 },
    defaultPorts: [
      { type: "input" },
      { type: "output", portID: "received", label: "收到数据" },
      { type: "output", portID: "error", label: "错误" },
    ],
  },
  onAdd() {
    return {
      id: `webhook_${nanoid(5)}`,
      type: WorkflowNodeType.Webhook,
      data: {
        title: `回传端点_${++index}`,
        toolName: "",
        toolDescription: "",
        timeoutMs: 0,
        inputSchema: {
          type: "object",
          properties: {
            data: {
              type: "object",
              title: "回传数据",
              description: "从 CubeCat 回传的数据",
            },
            action: {
              type: "string",
              title: "动作类型",
              description: "标识用户执行的动作",
            },
          },
        },
        inputs: {
          type: "object",
          properties: {
            context: {
              type: "string",
              title: "上下文",
              description: "可选。会原样带到输出。",
            },
          },
        },
        inputsValues: {
          context: { type: "constant", content: "" },
        },
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
              description: "接收到的完整参数",
            },
            action: {
              type: "string",
              title: "动作",
              description: "回传参数里的 action 字段",
            },
            timestamp: {
              type: "number",
              title: "时间戳",
              description: "回传时间",
            },
            context: {
              type: "string",
              title: "上下文",
              description: "从输入带过来的上下文",
            },
          },
        },
      },
    };
  },
  formMeta,
};
