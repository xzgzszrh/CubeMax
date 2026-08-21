/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useCurrentEntity, usePlaygroundContainer } from "@flowgram.ai/free-layout-editor";
import type { NodeReport } from "@flowgram.ai/runtime-interface";
import { useEffect, useState } from "react";

import { getWorkflowRuntimeService } from "../../../plugins/runtime-plugin/runtime-service";
import { NodeStatusRender } from "./render";

const useNodeReport = () => {
  const node = useCurrentEntity();
  const [report, setReport] = useState<NodeReport>();
  const container = usePlaygroundContainer();
  const runtimeService = getWorkflowRuntimeService(container);

  useEffect(() => {
    if (!runtimeService) return;
    const reportDisposer = runtimeService.onNodeReportChange((nodeReport) => {
      if (nodeReport.id !== node.id) {
        return;
      }
      setReport((prev) => ({
        ...prev,
        ...nodeReport,
      }));
    });
    const resetDisposer = runtimeService.onReset(() => {
      setReport(undefined);
    });
    return () => {
      reportDisposer.dispose();
      resetDisposer.dispose();
    };
  }, [node.id, runtimeService]);

  return report;
};

export const NodeStatusBar = () => {
  const report = useNodeReport();

  if (!report) {
    return null;
  }

  return <NodeStatusRender report={report} />;
};
