/**
 * 视觉节点 - CubeCat 拍照并用 camera.explain 分析
 */

import { nanoid } from "nanoid";

import iconVision from "../../assets/icon-vision.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const VisionNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Vision,
  info: {
    icon: iconVision,
    description: "让 CubeCat 拍照并用 camera.explain 分析画面。",
  },
  meta: {
    nodePanelLabel: "视觉识别",
    nodePanelGroup: "app",
    nodePanelGroupLabel: "智能交互",
    size: { width: 380, height: 480 },
    defaultPorts: [{ type: "input" }, { type: "output" }],
  },
  onAdd() {
    return {
      id: `vision_${nanoid(5)}`,
      type: WorkflowNodeType.Vision,
      data: {
        title: `视觉识别_${++index}`,
        // 拍摄模式: photo = 单张拍照, continuous = 连续拍摄, stream = 视频流
        captureMode: "photo",
        // 分析提示词
        analysisPrompt: "",
        // AI 模型选择
        modelId: "",
        // 是否保存图片
        saveImage: false,
        // 输入定义（可接收前置节点变量）
        inputs: {
          type: "object",
          properties: {
            context: {
              type: "string",
              title: "上下文",
              description: "来自前置节点的上下文信息",
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
              title: "成功",
              description: "是否成功获取图片",
            },
            imageUrl: {
              type: "string",
              title: "图片地址",
              description: "拍摄的图片 URL",
            },
            analysisResult: {
              type: "string",
              title: "分析结果",
              description: "AI 对图片的分析结果",
            },
            detectedObjects: {
              type: "array",
              title: "检测到的对象",
              description: "图像中检测到的对象列表",
              items: {
                type: "object",
                properties: {
                  label: { type: "string", title: "标签" },
                  confidence: { type: "number", title: "置信度" },
                  bbox: {
                    type: "object",
                    title: "边界框",
                    properties: {
                      x: { type: "number" },
                      y: { type: "number" },
                      width: { type: "number" },
                      height: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
  },
  formMeta,
};
