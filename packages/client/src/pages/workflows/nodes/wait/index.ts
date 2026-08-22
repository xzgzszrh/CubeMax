/**
 * 等待节点 - 等待特定条件满足后继续执行
 * 用于等待 MCP 回传数据、等待超时、等待变量变化等场景
 */

import { nanoid } from "nanoid";

import iconWait from "../../assets/icon-wait.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const WaitNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Wait,
  info: {
    icon: iconWait,
    description: "等待超时、CubeCat 调用 MCP 工具，或 HTTP 回传后再继续。",
  },
  meta: {
    nodePanelLabel: "等待",
    nodePanelGroup: "app",
    nodePanelGroupLabel: "智能交互",
    size: { width: 360, height: 420 },
    defaultPorts: [
      { type: "input" },
      { type: "output", portID: "continue", label: "继续" },
      { type: "output", portID: "timeout", label: "超时" },
    ],
  },
  onAdd() {
    return {
      id: `wait_${nanoid(5)}`,
      type: WorkflowNodeType.Wait,
      data: {
        title: `等待_${++index}`,
        waitType: "timeout",
        triggerId: "",
        timeoutMs: 5000,
        expectedDataPath: "",
        expectedValue: "",
        inputs: {
          type: "object",
          properties: {
            context: {
              type: "string",
              title: "上下文",
              description: "可选。会原样带到输出，方便下游使用。",
            },
            triggerId: {
              type: "string",
              title: "触发标识",
              description: "覆盖节点上填写的工具名或 Webhook 标识。",
            },
            timeoutMs: {
              type: "number",
              title: "超时毫秒",
              description: "覆盖节点上的超时时间。0 表示一直等到事件。",
            },
          },
        },
        inputsValues: {
          context: { type: "constant", content: "" },
          triggerId: { type: "constant", content: "" },
          timeoutMs: { type: "constant", content: "" },
        },
        outputs: {
          type: "object",
          properties: {
            triggered: {
              type: "boolean",
              title: "是否触发",
              description: "是否因等到事件而继续",
            },
            isTimeout: {
              type: "boolean",
              title: "是否超时",
              description: "是否因超时而继续",
            },
            data: {
              type: "object",
              title: "回传数据",
              description: "MCP 或 Webhook 带回的数据",
            },
            elapsedMs: {
              type: "number",
              title: "耗时(毫秒)",
              description: "从开始等到继续的时间",
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
