/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

export interface RuntimePluginOptions {
  mode: "server";
  serverConfig: ServerConfig;
  runtimeContext?: {
    projectId?: string;
  };
}

export interface ServerConfig {
  domain: string;
  port?: number;
  protocol?: string;
}
