/**
 * 智能体设置节点 - 用于切换 xiaozhi.me 设备的智能体提示词
 * 这是应用工作流的核心节点，用于管理设备与用户的语音交互行为
 */

import { nanoid } from "nanoid";

import iconAgent from "../../assets/icon-agent.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const AgentNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Agent,
  info: {
    icon: iconAgent,
    description: "切换智能体提示词，改变 CubeCat 与用户的语音交互行为。",
  },
  meta: {
    nodePanelLabel: "智能体",
    nodePanelGroup: "application",
    nodePanelGroupLabel: "智能交互",
    size: { width: 360, height: 420 },
    defaultPorts: [{ type: "output" }],
  },
  onAdd() {
    return {
      id: `agent_${nanoid(5)}`,
      type: WorkflowNodeType.Agent,
      data: {
        title: `智能体_${++index}`,
        // 智能体操作类型: switch_prompt = 切换提示词, enable = 启用, disable = 停用
        action: "switch_prompt",
        // 目标智能体 ID
        agentId: "",
        // 新的提示词内容
        prompt: "",
        // 提示词名称（用于显示）
        promptName: "",
        // 输出定义
        outputs: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              title: "操作成功",
              description: "智能体设置是否成功",
            },
            previousPrompt: {
              type: "string",
              title: "上一个提示词",
              description: "切换前的提示词内容",
            },
          },
        },
      },
    };
  },
  formMeta,
};
