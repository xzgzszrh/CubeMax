/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import {
  inject,
  injectable,
  WorkflowLinesManager,
  FlowNodeFormData,
  WorkflowDocument,
} from "@flowgram.ai/free-layout-editor";
import type { FlowNodeEntity, FormModelV2 } from "@flowgram.ai/free-layout-editor";

export interface ValidateFeedback {
  id: string;
  feedbackText: string;
  feedbackStatus: "error" | "warning";
  source: "form" | "connection";
  path?: string;
}

export interface ValidateResult {
  node: FlowNodeEntity;
  feedbacks: ValidateFeedback[];
}

@injectable()
export class ValidateService {
  @inject(WorkflowLinesManager)
  protected readonly linesManager: WorkflowLinesManager;

  @inject(WorkflowDocument) private readonly document: WorkflowDocument;

  validateLines() {
    const allLines = this.linesManager.getAllLines();
    allLines.forEach((line) => line.validate());
  }

  async validateNode(node: FlowNodeEntity): Promise<ValidateFeedback[]> {
    const feedbacks = await node
      .getData(FlowNodeFormData)
      .getFormModel<FormModelV2>()
      .validateWithFeedbacks();

    return feedbacks.flatMap((feedback, index) => {
      const feedbackText = feedback.feedbackText?.trim();
      if (!feedbackText) return [];

      return [
        {
          id: `${node.id}:form:${feedback.path}:${index}`,
          feedbackText,
          feedbackStatus: feedback.feedbackStatus === "warning" ? "warning" : "error",
          source: "form",
          path: feedback.path,
        } satisfies ValidateFeedback,
      ];
    });
  }

  private validateNodeConnections(node: FlowNodeEntity): ValidateFeedback[] {
    const expectsInput = node.ports.inputPorts.length > 0;
    const expectsOutput = node.ports.outputPorts.length > 0;
    const missingInput = expectsInput && node.lines.inputLines.length === 0;
    const missingOutput = expectsOutput && node.lines.outputLines.length === 0;

    if (!missingInput && !missingOutput) return [];

    let feedbackText = "此节点尚未连接到其他节点";
    if (!missingInput && missingOutput) {
      feedbackText = "此节点缺少输出连接";
    } else if (missingInput && !missingOutput) {
      feedbackText = "此节点缺少输入连接";
    }

    return [
      {
        id: `${node.id}:connection`,
        feedbackText,
        feedbackStatus: "error",
        source: "connection",
      },
    ];
  }

  async validateNodes(): Promise<ValidateResult[]> {
    const nodes = this.document.getAssociatedNodes();
    this.validateLines();

    const results = await Promise.all(
      nodes.map(async (node) => {
        const formFeedbacks = await this.validateNode(node);
        return {
          feedbacks: [...formFeedbacks, ...this.validateNodeConnections(node)],
          node,
        };
      }),
    );

    return results.filter((i) => i.feedbacks.length);
  }
}
