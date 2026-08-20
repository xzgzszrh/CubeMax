/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { nanoid } from "nanoid";

import iconCode from "../../assets/icon-script.png";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

const defaultCode = `// 可以通过 'params' 读取节点输入，并通过返回值输出结果。
// 'params' 已经注入到运行环境中。
// 下面示例从节点输入中读取名为 'input' 的参数：
// const input = params.input;
// 下面示例返回一个包含多种数据类型的对象：
// const ret = { "name": 'Xiaoming', "hobbies": ["Reading", "Traveling"] };

async function main({ params }) {
  // 构造输出对象
  const ret = {
    key0: params.input + params.input, // 将输入参数 'input' 拼接两次
    key1: ["hello", "world"], // 输出数组
    key2: { // 输出对象
      key21: "hi"
    },
  };

  return ret;
}`;

export const CodeNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Code,
  info: {
    icon: iconCode,
    description: "运行自定义脚本并输出结构化结果。",
  },
  meta: {
    nodePanelLabel: "代码",
    size: {
      width: 320,
      height: 390,
    },
  },
  onAdd() {
    return {
      id: `code_${nanoid(5)}`,
      type: "code",
      data: {
        title: `代码_${++index}`,
        inputsValues: {
          input: { type: "constant", content: "" },
        },
        script: {
          language: "javascript",
          content: defaultCode,
        },
        outputs: {
          type: "object",
          properties: {
            key0: {
              type: "string",
            },
            key1: {
              type: "array",
              items: {
                type: "string",
              },
            },
            key2: {
              type: "object",
              properties: {
                key21: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    };
  },
  formMeta: formMeta,
};
