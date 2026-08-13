import { LuaFactory } from "wasmoon";
import { parentPort } from "worker_threads";

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
        lua.global.set("__device_snapshot", input.deviceSnapshot ?? {});
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

local __device_operations = {}
local __device_available = __device_snapshot.available == true

local function require_device()
    if not __device_available then
        error("请先选择一个虚拟设备会话")
    end
end

local function append_device_operation(action, args)
    require_device()
    table.insert(__device_operations, { action = action, args = args })
end

device = {
    gpio_set_mode = function(pin, mode)
        append_device_operation("gpio_set_mode", { pin = tostring(pin), mode = mode })
    end,
    gpio_write = function(pin, value)
        append_device_operation("gpio_write", { pin = tostring(pin), value = value == true })
    end,
    gpio_read = function(pin)
        require_device()
        return __device_snapshot.digitalPins[tostring(pin)] == true
    end,
    analog_read = function(pin)
        require_device()
        return __device_snapshot.analogPins[tostring(pin)] or 0
    end,
    pwm_write = function(pin, duty_cycle, frequency_hz)
        append_device_operation("pwm_write", {
            pin = tostring(pin),
            dutyCycle = duty_cycle,
            frequencyHz = frequency_hz or 1000
        })
    end,
    servo_write_angle = function(pin, angle)
        append_device_operation("servo_write_angle", { pin = tostring(pin), angle = angle })
    end,
    serial_write = function(text)
        append_device_operation("serial_write_text", { text = tostring(text) })
    end,
    button_pressed = function()
        require_device()
        return __device_snapshot.buttonPressed == true
    end,
    potentiometer_value = function()
        require_device()
        return __device_snapshot.potentiometerValue or 0
    end
}

${input.code}

if type(main) ~= "function" then
    error("脚本必须定义 main(params) 函数")
end

if ${input.validateOnly ? "true" : "false"} then
    return { result = true, deviceOperations = {} }
end

return { result = main(params), deviceOperations = __device_operations }
`);
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
