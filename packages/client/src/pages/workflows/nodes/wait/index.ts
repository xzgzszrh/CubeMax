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
    description: "等待特定条件满足，例如 MCP 回传数据、超时或变量变化。",
  },
  meta: {
    nodePanelLabel: "等待",
    nodePanelGroup: "application",
    nodePanelGroupLabel: "智能交互",
    size: { width: 360, height: 380 },
    defaultPorts: [
      { type: "output", label: "继续" },
      { type: "output", label: "超时" },
    ],
  },
  onAdd() {
    return {
      id: `wait_${nanoid(5)}`,
      type: WorkflowNodeType.Wait,
      data: {
        title: `等待_${++index}`,
        // 等待类型: mcp_call = 等待 MCP 调用, timeout = 超时等待, variable = 变量变化
        waitType: "mcp_call",
        // 关联的 MCP 节点 ID 或 webhook 配置 ID
        triggerId: "",
        // 超时时间（毫秒），0 表示不超时
        timeoutMs: 0,
        // 期望的数据路径，例如 data.result
        expectedDataPath: "",
        // 期望的值（可选），用于条件判断
        expectedValue: "",
        // 输出定义
        outputs: {
          type: "object",
          properties: {
            triggered: {
              type: "boolean",
              title: "是否触发",
              description: "是否满足条件继续执行",
            },
            isTimeout: {
              type: "boolean",
              title: "是否超时",
              description: "是否因超时而继续",
            },
            data: {
              type: "object",
              title: "回传数据",
              description: "MCP 回传的数据内容",
            },
            elapsedMs: {
              type: "number",
              title: "耗时(毫秒)",
              description: "从等待到继续的耗时",
            },
          },
        },
      },
    };
  },
  formMeta,
};
