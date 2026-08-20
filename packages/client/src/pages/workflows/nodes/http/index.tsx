/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import iconHTTP from "../../assets/icon-http.svg";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const HTTPNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.HTTP,
  info: {
    icon: iconHTTP,
    description: "调用 HTTP API 并获取响应结果。",
  },
  meta: {
    nodePanelLabel: "HTTP 请求",
    size: {
      width: 320,
      height: 390,
    },
  },
  onAdd() {
    return {
      id: `http_${nanoid(5)}`,
      type: "http",
      data: {
        title: `HTTP请求_${++index}`,
        api: {
          method: "GET",
        },
        body: {
          bodyType: "JSON",
        },
        headers: {},
        params: {},
        outputs: {
          type: "object",
          properties: {
            body: { type: "string", title: "响应体" },
            headers: { type: "object", title: "响应头" },
            statusCode: { type: "integer", title: "状态码" },
          },
        },
      },
    };
  },
  formMeta: formMeta,
};
