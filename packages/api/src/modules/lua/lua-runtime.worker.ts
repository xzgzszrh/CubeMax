import { parentPort } from "worker_threads";
import { LuaFactory } from "wasmoon";

type LuaWorkerInput = {
    code: string;
    params: Record<string, unknown>;
    validateOnly?: boolean;
};

type LuaWorkerOutput = { ok: true; result: unknown } | { ok: false; error: string };

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
        const result = await lua.doString(`
io = nil
os = nil
package = nil
require = nil
dofile = nil
loadfile = nil
load = nil
debug = nil
print = nil
collectgarbage = nil

${input.code}

if type(main) ~= "function" then
    error("脚本必须定义 main(params) 函数")
end

if ${input.validateOnly ? "true" : "false"} then
    return true
end

return main(params)
`);
        return { ok: true, result };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
        lua.global.close();
    }
}

parentPort?.once("message", async (input: LuaWorkerInput) => {
    parentPort?.postMessage(await execute(input));
});
