import { HttpErrorFactory } from "@buildingai/errors";
import type { LuaExecutorInput } from "@flowgram.ai/runtime-js";
import { Injectable } from "@nestjs/common";

import { LuaModuleService } from "../lua/lua-module.service";

@Injectable()
export class WorkflowLuaExecutorService {
    constructor(private readonly luaModuleService: LuaModuleService) {}

    async execute(input: LuaExecutorInput): Promise<Record<string, unknown>> {
        if (!input.userId) throw HttpErrorFactory.unauthorized("Lua 节点需要登录后执行");
        const moduleId = input.node.data?.luaModuleId;
        if (typeof moduleId !== "string" || !moduleId) {
            throw HttpErrorFactory.badRequest("Lua 节点尚未选择模块");
        }
        return (await this.luaModuleService.executePublished(moduleId, input.userId, input.inputs))
            .output;
    }
}
