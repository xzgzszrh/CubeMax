/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { WorkflowVariableType } from "@flowgram.ai/runtime-interface";
import type { ConditionHandlers } from "../type.ts";
import { conditionStringHandler } from "./string.ts";
import { conditionObjectHandler } from "./object.ts";
import { conditionNumberHandler } from "./number.ts";
import { conditionNullHandler } from "./null.ts";
import { conditionMapHandler } from "./map.ts";
import { conditionDateTimeHandler } from "./datetime.ts";
import { conditionBooleanHandler } from "./boolean.ts";
import { conditionArrayHandler } from "./array.ts";

export const conditionHandlers: ConditionHandlers = {
    [WorkflowVariableType.String]: conditionStringHandler,
    [WorkflowVariableType.Number]: conditionNumberHandler,
    [WorkflowVariableType.Integer]: conditionNumberHandler,
    [WorkflowVariableType.Boolean]: conditionBooleanHandler,
    [WorkflowVariableType.Object]: conditionObjectHandler,
    [WorkflowVariableType.Map]: conditionMapHandler,
    [WorkflowVariableType.Array]: conditionArrayHandler,
    [WorkflowVariableType.DateTime]: conditionDateTimeHandler,
    [WorkflowVariableType.Null]: conditionNullHandler,
};
