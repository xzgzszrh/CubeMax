/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { FlowDocumentJSON } from "./typings";

export const initialData: FlowDocumentJSON = {
  nodes: [
    {
      id: "start_0",
      type: "start",
      meta: {
        position: {
          x: 180,
          y: 601.2,
        },
      },
      data: {
        title: "开始",
        outputs: {
          type: "object",
          properties: {
            query: {
              type: "string",
              default: "Hello Flow.",
            },
            enable: {
              type: "boolean",
              default: true,
            },
            array_obj: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  int: {
                    type: "number",
                  },
                  str: {
                    type: "string",
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      id: "condition_0",
      type: "condition",
      meta: {
        position: {
          x: 1100,
          y: 546.2,
        },
      },
      data: {
        title: "条件分支",
        conditions: [
          {
            key: "if_0",
            value: {
              left: {
                type: "ref",
                content: ["start_0", "query"],
              },
              operator: "contains",
              right: {
                type: "constant",
                content: "Hello Flow.",
              },
            },
          },
        ],
      },
    },
    {
      id: "end_0",
      type: "end",
      meta: {
        position: {
          x: 2968,
          y: 601.2,
        },
      },
      data: {
        title: "结束",
        inputsValues: {
          success: {
            type: "constant",
            content: true,
            schema: {
              type: "boolean",
            },
          },
          query: {
            type: "ref",
            content: ["start_0", "query"],
          },
        },
        inputs: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
            },
            query: {
              type: "string",
            },
          },
        },
      },
    },
    {
      id: "159623",
      type: "comment",
      meta: {
        position: {
          x: 180,
          y: 775.2,
        },
      },
      data: {
        size: {
          width: 240,
          height: 150,
        },
        note: "你好 ~\n\n这是一个注释节点\n\n- flowgram.ai",
      },
    },
    {
      id: "http_rDGIH",
      type: "http",
      meta: {
        position: {
          x: 640,
          y: 421.35,
        },
      },
      data: {
        title: "HTTP请求_1",
        outputs: {
          type: "object",
          properties: {
            body: {
              type: "string",
              title: "响应体",
            },
            headers: {
              type: "object",
              title: "响应头",
            },
            statusCode: {
              type: "integer",
              title: "状态码",
            },
          },
        },
        api: {
          method: "GET",
          url: {
            type: "template",
            content: "",
          },
        },
        body: {
          bodyType: "JSON",
        },
        timeout: {
          timeout: 10000,
          retryTimes: 1,
        },
      },
    },
    {
      id: "loop_Ycnsk",
      type: "loop",
      meta: {
        position: {
          x: 1460,
          y: 0,
        },
      },
      data: {
        title: "循环_1",
        loopFor: {
          type: "ref",
          content: ["start_0", "array_obj"],
        },
        loopOutputs: {
          acm: {
            type: "ref",
            content: ["llm_6aSyo", "result"],
          },
        },
        outputs: {
          type: "object",
          required: [],
          properties: {
            acm: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
        },
      },
      blocks: [
        {
          id: "llm_6aSyo",
          type: "llm",
          meta: {
            position: {
              x: 344,
              y: 0,
            },
          },
          data: {
            title: "大模型_3",
            inputsValues: {
              modelId: {
                type: "constant",
                content: "",
              },
              temperature: {
                type: "constant",
                content: 0.5,
              },
              systemPrompt: {
                type: "template",
                content: "# 角色\n你是一个 AI 助手。\n",
              },
              prompt: {
                type: "template",
                content: "",
              },
            },
            inputs: {
              type: "object",
              required: ["modelId", "temperature", "prompt"],
              properties: {
                modelId: {
                  type: "string",
                  title: "模型",
                  description: "选择用于生成回复的大语言模型。",
                  extra: {
                    formComponent: "llm-model-select",
                  },
                },
                temperature: {
                  type: "number",
                  title: "温度",
                  description: "控制生成结果的随机性，数值越高越发散。",
                },
                systemPrompt: {
                  type: "string",
                  title: "系统提示词",
                  description: "用于设定模型角色和行为边界。",
                  extra: {
                    formComponent: "prompt-editor",
                  },
                },
                prompt: {
                  type: "string",
                  title: "用户提示词",
                  description: "发送给模型的主要输入内容。",
                  extra: {
                    formComponent: "prompt-editor",
                  },
                },
              },
            },
            outputs: {
              type: "object",
              properties: {
                result: {
                  type: "string",
                  title: "结果",
                },
              },
            },
          },
        },
        {
          id: "llm_ZqKlP",
          type: "llm",
          meta: {
            position: {
              x: 804,
              y: 0,
            },
          },
          data: {
            title: "大模型_4",
            inputsValues: {
              modelId: {
                type: "constant",
                content: "",
              },
              temperature: {
                type: "constant",
                content: 0.5,
              },
              systemPrompt: {
                type: "template",
                content: "# 角色\n你是一个 AI 助手。\n",
              },
              prompt: {
                type: "template",
                content: "",
              },
            },
            inputs: {
              type: "object",
              required: ["modelId", "temperature", "prompt"],
              properties: {
                modelId: {
                  type: "string",
                  title: "模型",
                  description: "选择用于生成回复的大语言模型。",
                  extra: {
                    formComponent: "llm-model-select",
                  },
                },
                temperature: {
                  type: "number",
                  title: "温度",
                  description: "控制生成结果的随机性，数值越高越发散。",
                },
                systemPrompt: {
                  type: "string",
                  title: "系统提示词",
                  description: "用于设定模型角色和行为边界。",
                  extra: {
                    formComponent: "prompt-editor",
                  },
                },
                prompt: {
                  type: "string",
                  title: "用户提示词",
                  description: "发送给模型的主要输入内容。",
                  extra: {
                    formComponent: "prompt-editor",
                  },
                },
              },
            },
            outputs: {
              type: "object",
              properties: {
                result: {
                  type: "string",
                  title: "结果",
                },
              },
            },
          },
        },
        {
          id: "block_start_PUDtS",
          type: "block-start",
          meta: {
            position: {
              x: 32,
              y: 167.1,
            },
          },
          data: {},
        },
        {
          id: "block_end_leBbs",
          type: "block-end",
          meta: {
            position: {
              x: 1116,
              y: 167.1,
            },
          },
          data: {},
        },
      ],
      edges: [
        {
          sourceNodeID: "block_start_PUDtS",
          targetNodeID: "llm_6aSyo",
        },
        {
          sourceNodeID: "llm_6aSyo",
          targetNodeID: "llm_ZqKlP",
        },
        {
          sourceNodeID: "llm_ZqKlP",
          targetNodeID: "block_end_leBbs",
        },
      ],
    },
    {
      id: "group_nYl6D",
      type: "group",
      meta: {
        position: {
          x: 1624,
          y: 698.2,
        },
      },
      data: {
        parentID: "root",
        blockIDs: ["llm_8--A3", "llm_vTyMa"],
      },
    },
    {
      id: "llm_8--A3",
      type: "llm",
      meta: {
        position: {
          x: 180,
          y: 0,
        },
      },
      data: {
        title: "大模型_1",
        inputsValues: {
          modelId: {
            type: "constant",
            content: "",
          },
          temperature: {
            type: "constant",
            content: 0.5,
          },
          systemPrompt: {
            type: "template",
            content: "# 角色\n你是一个 AI 助手。\n",
          },
          prompt: {
            type: "template",
            content: "# 用户输入\nquery:{{start_0.query}}\nenable:{{start_0.enable}}",
          },
        },
        inputs: {
          type: "object",
          required: ["modelId", "temperature", "prompt"],
          properties: {
            modelId: {
              type: "string",
              title: "模型",
              description: "选择用于生成回复的大语言模型。",
              extra: {
                formComponent: "llm-model-select",
              },
            },
            temperature: {
              type: "number",
              title: "温度",
              description: "控制生成结果的随机性，数值越高越发散。",
            },
            systemPrompt: {
              type: "string",
              title: "系统提示词",
              description: "用于设定模型角色和行为边界。",
              extra: {
                formComponent: "prompt-editor",
              },
            },
            prompt: {
              type: "string",
              title: "用户提示词",
              description: "发送给模型的主要输入内容。",
              extra: {
                formComponent: "prompt-editor",
              },
            },
          },
        },
        outputs: {
          type: "object",
          properties: {
            result: {
              type: "string",
              title: "结果",
            },
          },
        },
      },
    },
    {
      id: "llm_vTyMa",
      type: "llm",
      meta: {
        position: {
          x: 640,
          y: 10,
        },
      },
      data: {
        title: "大模型_2",
        inputsValues: {
          modelId: {
            type: "constant",
            content: "",
          },
          temperature: {
            type: "constant",
            content: 0.5,
          },
          systemPrompt: {
            type: "template",
            content: "# 角色\n你是一个 AI 助手。\n",
          },
          prompt: {
            type: "template",
            content: "# 大模型输入\nresult:{{llm_8--A3.result}}",
          },
        },
        inputs: {
          type: "object",
          required: ["modelId", "temperature", "prompt"],
          properties: {
            modelId: {
              type: "string",
              title: "模型",
              description: "选择用于生成回复的大语言模型。",
              extra: {
                formComponent: "llm-model-select",
              },
            },
            temperature: {
              type: "number",
              title: "温度",
              description: "控制生成结果的随机性，数值越高越发散。",
            },
            systemPrompt: {
              type: "string",
              title: "系统提示词",
              description: "用于设定模型角色和行为边界。",
              extra: {
                formComponent: "prompt-editor",
              },
            },
            prompt: {
              type: "string",
              title: "用户提示词",
              description: "发送给模型的主要输入内容。",
              extra: {
                formComponent: "prompt-editor",
              },
            },
          },
        },
        outputs: {
          type: "object",
          properties: {
            result: {
              type: "string",
              title: "结果",
            },
          },
        },
      },
    },
  ],
  edges: [
    {
      sourceNodeID: "start_0",
      targetNodeID: "http_rDGIH",
    },
    {
      sourceNodeID: "http_rDGIH",
      targetNodeID: "condition_0",
    },
    {
      sourceNodeID: "condition_0",
      targetNodeID: "loop_Ycnsk",
      sourcePortID: "if_0",
    },
    {
      sourceNodeID: "condition_0",
      targetNodeID: "llm_8--A3",
      sourcePortID: "else",
    },
    {
      sourceNodeID: "llm_vTyMa",
      targetNodeID: "end_0",
    },
    {
      sourceNodeID: "loop_Ycnsk",
      targetNodeID: "end_0",
    },
    {
      sourceNodeID: "llm_8--A3",
      targetNodeID: "llm_vTyMa",
    },
  ],
  globalVariable: {
    type: "object",
    required: [],
    properties: {
      userId: {
        type: "string",
      },
    },
  },
};
