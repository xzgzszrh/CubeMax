/**
 * 语音播报节点 - 用于通过 xiaozhi.me 设备播放语音
 * 应用工作流中用于语音反馈、播报提醒等场景
 */

import { nanoid } from "nanoid";

import iconSpeech from "../../assets/icon-speech.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const SpeechNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Speech,
  info: {
    icon: iconSpeech,
    description: "通过 xiaozhi.me 设备播放语音，用于语音反馈和提醒。",
  },
  meta: {
    nodePanelLabel: "语音播报",
    nodePanelGroup: "application",
    nodePanelGroupLabel: "智能交互",
    size: { width: 360, height: 400 },
    defaultPorts: [{ type: "output" }],
  },
  onAdd() {
    return {
      id: `speech_${nanoid(5)}`,
      type: WorkflowNodeType.Speech,
      data: {
        title: `语音播报_${++index}`,
        // 目标智能体 ID（由工程设置中配置）
        agentId: "",
        // 播报内容（可引用前置节点变量）
        text: "",
        // 播报模式: speak = 立即播报, queue = 排队播报
        mode: "speak",
        // TTS 模型
        modelId: "",
        // 语速 (0.5 - 2.0)
        speed: 1.0,
        // 音量 (0 - 1)
        volume: 1.0,
        // 是否等待播报完成
        waitForComplete: true,
        // 输入定义（可接收前置节点变量）
        inputs: {
          type: "object",
          properties: {
            content: {
              type: "string",
              title: "播报内容",
              description: "来自前置节点的内容",
            },
          },
        },
        inputsValues: {},
        // 输出定义
        outputs: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              title: "播放成功",
              description: "语音是否成功开始播放",
            },
            durationMs: {
              type: "number",
              title: "播放时长(毫秒)",
              description: "语音播放的预计时长",
            },
          },
        },
      },
    };
  },
  formMeta,
};
