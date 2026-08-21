/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import type { PluginContext } from "@flowgram.ai/free-layout-editor";
import { definePluginCreator } from "@flowgram.ai/free-layout-editor";

import { WorkflowRuntimeClient, WorkflowRuntimeServerClient } from "./client";
import {
  getWorkflowRuntimeService,
  WorkflowRuntimeService,
  WorkflowRuntimeServiceId,
} from "./runtime-service";
import type { RuntimePluginOptions } from "./type";

function assertServerRuntimeOptions(
  options: RuntimePluginOptions | undefined,
): asserts options is RuntimePluginOptions {
  const mode = (options as { mode?: string } | undefined)?.mode;
  if (mode !== "server") {
    throw new Error("Workflow runtime only supports server mode.");
  }
}

export const createRuntimePlugin = definePluginCreator<RuntimePluginOptions, PluginContext>({
  onBind({ bind, rebind, isBound }, options) {
    assertServerRuntimeOptions(options);

    if (!isBound(WorkflowRuntimeClient)) {
      bind(WorkflowRuntimeClient).toSelf().inSingletonScope();
    }
    if (!isBound(WorkflowRuntimeServerClient)) {
      bind(WorkflowRuntimeServerClient).toSelf().inSingletonScope();
    }
    rebind(WorkflowRuntimeClient).to(WorkflowRuntimeServerClient);
    if (!isBound(WorkflowRuntimeService)) {
      bind(WorkflowRuntimeService).toSelf().inSingletonScope();
    }
    if (!isBound(WorkflowRuntimeServiceId)) {
      bind(WorkflowRuntimeServiceId).toService(WorkflowRuntimeService);
    }
  },
  onInit(ctx, options) {
    assertServerRuntimeOptions(options);

    const serverClient = ctx.get<WorkflowRuntimeServerClient>(WorkflowRuntimeClient);
    serverClient.init(options.serverConfig);
    getWorkflowRuntimeService(ctx.container)?.setRuntimeContext(options.runtimeContext);
  },
});
