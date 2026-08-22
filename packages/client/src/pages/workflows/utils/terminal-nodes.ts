/**
 * 保证主流程始终有开始、结束节点。
 */

import type { FlowDocumentJSON, FlowNodeJSON } from "../typings";

const DEFAULT_START_NODE: FlowNodeJSON = {
  id: "start_0",
  type: "start",
  meta: { position: { x: 180, y: 300 } },
  data: {
    title: "开始",
    outputs: { type: "object", properties: {} },
  },
};

const DEFAULT_END_NODE: FlowNodeJSON = {
  id: "end_0",
  type: "end",
  meta: { position: { x: 640, y: 300 } },
  data: {
    title: "结束",
    inputsValues: {},
    inputs: { type: "object", properties: {} },
  },
};

function cloneNode(node: FlowNodeJSON): FlowNodeJSON {
  return structuredClone(node);
}

export function ensureTerminalNodes(
  schema: FlowDocumentJSON,
  fallback?: FlowDocumentJSON,
): FlowDocumentJSON {
  const nodes = [...schema.nodes];
  const edges = [...schema.edges];
  const fallbackStart = fallback?.nodes.find((node) => node.type === "start");
  const fallbackEnd = fallback?.nodes.find((node) => node.type === "end");

  if (nodes.length === 0 && fallbackStart && fallbackEnd) {
    return structuredClone(fallback);
  }

  let start = nodes.find((node) => node.type === "start");
  if (!start) {
    start = cloneNode(fallbackStart ?? DEFAULT_START_NODE);
    nodes.unshift(start);
  }
  let end = nodes.find((node) => node.type === "end");
  if (!end) {
    end = cloneNode(fallbackEnd ?? DEFAULT_END_NODE);
    nodes.push(end);
  }

  const others = nodes.filter((node) => node.type !== "start" && node.type !== "end");
  if (!edges.some((edge) => edge.sourceNodeID === start.id)) {
    edges.push({
      sourceNodeID: start.id,
      targetNodeID: others[0]?.id ?? end.id,
    });
  }
  if (!edges.some((edge) => edge.targetNodeID === end.id)) {
    edges.push({
      sourceNodeID: others.at(-1)?.id ?? start.id,
      targetNodeID: end.id,
    });
  }

  return {
    ...schema,
    nodes,
    edges,
  };
}
