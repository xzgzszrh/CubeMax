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
    nodePanelLabel: "设置智能体",
    nodePanelGroup: "app",
    nodePanelGroupLabel: "智能交互",
    size: { width: 360, height: 460 },
    defaultPorts: [{ type: "input" }, { type: "output" }],
  },
  onAdd() {
    return {
      id: `agent_${nanoid(5)}`,
      type: WorkflowNodeType.Agent,
      data: {
        title: `设置智能体_${++index}`,
        action: "switch_prompt",
        promptName: "",
        inputs: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              title: "提示词内容",
              description: "写入 CubeCat 的角色提示词，可引用上游变量。",
              extra: { formComponent: "prompt-editor" },
            },
            trigger: {
              type: "string",
              title: "触发信息",
              description: "可选。来自上游的文字会追加到提示词后面。",
            },
          },
        },
        inputsValues: {
          prompt: { type: "constant", content: "" },
          trigger: { type: "constant", content: "" },
        },
        outputs: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              title: "操作成功",
              description: "智能体提示词是否切换成功",
            },
            previousPrompt: {
              type: "string",
              title: "上一个提示词",
              description: "切换前的角色提示词",
            },
            currentPrompt: {
              type: "string",
              title: "当前提示词",
              description: "本次写入设备的提示词",
            },
            agentName: {
              type: "string",
              title: "智能体名称",
              description: "工程绑定的 CubeCat 智能体",
            },
          },
        },
      },
    };
  },
  formMeta,
};
