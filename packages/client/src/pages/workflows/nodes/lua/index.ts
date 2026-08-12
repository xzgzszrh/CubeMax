import { nanoid } from "nanoid";

import iconCode from "../../assets/icon-script.png";
import type { FlowNodeRegistry } from "../../typings";
import { WorkflowNodeType } from "../constants";
import { formMeta } from "./form-meta";

let index = 0;

export const LuaNodeRegistry: FlowNodeRegistry = {
  type: WorkflowNodeType.Lua,
  info: {
    icon: iconCode,
    description: "执行已发布的 Lua 脚本模块。",
  },
  meta: {
    nodePanelLabel: "Lua 模块",
    size: { width: 360, height: 390 },
  },
  onAdd() {
    return {
      id: `lua_${nanoid(5)}`,
      type: WorkflowNodeType.Lua,
      data: {
        title: `Lua模块_${++index}`,
        luaModuleId: "",
        inputs: { type: "object", properties: {} },
        inputsValues: {},
        outputs: { type: "object", properties: {} },
      },
    };
  },
  formMeta,
};
