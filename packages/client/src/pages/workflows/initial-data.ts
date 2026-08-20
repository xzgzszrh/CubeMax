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
          y: 300,
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
      id: "end_0",
      type: "end",
      meta: {
        position: {
          x: 640,
          y: 300,
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
  ],
  edges: [
    {
      sourceNodeID: "start_0",
      targetNodeID: "end_0",
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

/**
 * Application programs start without a conversational input contract. Students
 * add actions and device nodes after this single entry point.
 */
export const applicationInitialData: FlowDocumentJSON = {
  nodes: [
    {
      id: "start_0",
      type: "start",
      meta: {
        position: {
          x: 180,
          y: 300,
        },
      },
      data: {
        title: "开始",
        outputs: {
          type: "object",
          properties: {},
        },
      },
    },
  ],
  edges: [],
  globalVariable: {
    type: "object",
    required: [],
    properties: {},
  },
};
