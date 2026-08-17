import type { ProgrammingProjectPublishedSnapshot } from "@buildingai/db/entities";
import { HttpErrorFactory } from "@buildingai/errors";
import type { LuaExecutorInput } from "@flowgram.ai/runtime-js";
import { Injectable } from "@nestjs/common";

import { LuaDeviceGatewayService } from "../lua-device/lua-device-gateway.service";
import { LuaModuleService } from "../lua/lua-module.service";
import { LuaRuntimeService } from "../lua/lua-runtime.service";
import { SimulatorService } from "../simulator/simulator.service";

type RuntimeContext = NonNullable<LuaExecutorInput["runtimeContext"]>;

function isPublishedSnapshot(value: unknown): value is ProgrammingProjectPublishedSnapshot {
    return (
        !!value &&
        typeof value === "object" &&
        (value as ProgrammingProjectPublishedSnapshot).version === 1 &&
        Array.isArray((value as ProgrammingProjectPublishedSnapshot).luaModules)
    );
}

@Injectable()
export class WorkflowLuaExecutorService {
    constructor(
        private readonly luaModuleService: LuaModuleService,
        private readonly luaRuntimeService: LuaRuntimeService,
        private readonly simulatorService: SimulatorService,
        private readonly luaDeviceGatewayService: LuaDeviceGatewayService,
    ) {}

    async execute(input: LuaExecutorInput): Promise<Record<string, unknown>> {
        if (!input.userId) throw HttpErrorFactory.unauthorized("Lua 节点需要登录后执行");
        const moduleId = input.node.data?.luaModuleId;
        if (typeof moduleId !== "string" || !moduleId) {
            throw HttpErrorFactory.badRequest("Lua 节点尚未选择模块");
        }
        const context = input.runtimeContext;
        const snapshot = isPublishedSnapshot(context?.publishedSnapshot)
            ? context.publishedSnapshot
            : undefined;
        let source: string;
        let moduleName = "Lua 模块";

        if (snapshot) {
            const luaModule = snapshot.luaModules.find((item) => item.id === moduleId);
            if (!luaModule) {
                throw HttpErrorFactory.badRequest("已发布工程未包含当前 Lua 模块");
            }
            source = luaModule.code;
            moduleName = luaModule.name;
        } else if (context?.projectId) {
            const luaModule = await this.luaModuleService.findOne(moduleId, input.userId);
            if (luaModule.projectId !== context.projectId) {
                throw HttpErrorFactory.badRequest("Lua 模块不属于当前工程");
            }
            source = luaModule.draftCode;
            moduleName = luaModule.name;
        } else {
            return (await this.luaModuleService.executePublished(moduleId, input.userId, input.inputs))
                .output;
        }

        return this.executeForTarget(
            source,
            moduleName,
            moduleId,
            input.userId,
            input.inputs,
            context,
        );
    }

    private async executeForTarget(
        source: string,
        moduleName: string,
        moduleId: string,
        userId: string,
        inputs: Record<string, unknown>,
        context?: RuntimeContext,
    ): Promise<Record<string, unknown>> {
        const target = context?.runtimeTarget ?? "local";
        if (target === "local") {
            return (await this.luaRuntimeService.execute(source, inputs)).output;
        }

        if (target === "simulator") {
            if (!context?.simulatorSessionId) {
                throw HttpErrorFactory.badRequest("工程尚未选择仿真会话");
            }
            if (context.projectId) {
                this.simulatorService.getForProjectUser(
                    context.simulatorSessionId,
                    userId,
                    context.projectId,
                );
            } else {
                this.simulatorService.getForUser(context.simulatorSessionId, userId);
            }
            return (await this.luaRuntimeService.execute(source, inputs, context.simulatorSessionId)).output;
        }

        if (!context?.deviceId) {
            throw HttpErrorFactory.badRequest("工程尚未选择 CubeCat 物理设备");
        }
        const usesDisplay = /\bxiaozhi\s*\.\s*ui\b/.test(source);
        const run = await this.luaDeviceGatewayService.createRun(userId, context.deviceId, {
            name: moduleName.slice(0, 100),
            moduleId,
            projectId: context.projectId,
            source,
            params: inputs,
            requiredCapabilities: usesDisplay ? ["lua", "xiaozhi", "display"] : ["lua", "xiaozhi"],
            timeoutMs: usesDisplay ? 60_000 : 10_000,
        });
        const completed = await this.luaDeviceGatewayService.waitForRun(
            userId,
            context.deviceId,
            run.id,
        );
        if (completed.status !== "succeeded") {
            throw HttpErrorFactory.badRequest(completed.error?.message ?? "CubeCat 执行失败");
        }
        return completed.result && typeof completed.result === "object" && !Array.isArray(completed.result)
            ? (completed.result as Record<string, unknown>)
            : { result: completed.result };
    }
}
