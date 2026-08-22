import { LuaFactory } from "wasmoon";
import { parentPort } from "worker_threads";

import { CLAW4_SIM_PRELUDE } from "./claw4-sim-prelude";

type LuaWorkerInput = {
    code: string;
    params: Record<string, unknown>;
    deviceSnapshot?: Record<string, unknown>;
    validateOnly?: boolean;
};

type LuaWorkerOutput =
    | {
          ok: true;
          result: unknown;
          deviceOperations: Array<{ action: string; args: Record<string, unknown> }>;
      }
    | { ok: false; error: string };

const EPILOGUE = `
if type(main) ~= "function" then
    error("脚本必须定义 main(params) 函数")
end

if __cubemax_validate_only then
    return { result = true, deviceOperations = {} }
end

return { result = main(params), deviceOperations = __device_operations }
`;

async function execute(input: LuaWorkerInput): Promise<LuaWorkerOutput> {
    const factory = new LuaFactory();
    const lua = await factory.createEngine({
        openStandardLibs: true,
        injectObjects: false,
        enableProxy: false,
        traceAllocations: true,
    });

    try {
        lua.global.setMemoryMax(16 * 1024 * 1024);
        lua.global.set("params", input.params);
        lua.global.set("args", input.params);
        lua.global.set("__device_snapshot", input.deviceSnapshot ?? {});
        lua.global.set("__cubemax_validate_only", Boolean(input.validateOnly));
        const result = await lua.doString(`${CLAW4_SIM_PRELUDE}\n${input.code}\n${EPILOGUE}`);
        const wrapped = result as {
            result?: unknown;
            deviceOperations?: Array<{ action: string; args: Record<string, unknown> }>;
        };
        return {
            ok: true,
            result: wrapped?.result,
            deviceOperations: Array.isArray(wrapped?.deviceOperations)
                ? wrapped.deviceOperations
                : [],
        };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
        lua.global.close();
    }
}

parentPort?.once("message", async (input: LuaWorkerInput) => {
    parentPort?.postMessage(await execute(input));
});
