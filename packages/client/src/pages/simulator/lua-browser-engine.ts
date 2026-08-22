import * as Wasmoon from "wasmoon";
import wasmUrl from "wasmoon/dist/glue.wasm?url";

import { CLAW4_SCREEN_HEIGHT, CLAW4_SCREEN_WIDTH } from "./claw4-compat";
import type { DisplayHost, SimDeviceOperation, SimUiEvent } from "./display-host";

type LuaFactoryConstructor = (typeof import("wasmoon"))["LuaFactory"];

function resolveLuaFactory(): LuaFactoryConstructor {
  const module = Wasmoon as unknown as {
    LuaFactory?: LuaFactoryConstructor;
    default?: { LuaFactory?: LuaFactoryConstructor };
  };
  const LuaFactory = module.LuaFactory ?? module.default?.LuaFactory;
  if (!LuaFactory) {
    throw new Error("wasmoon LuaFactory is unavailable");
  }
  return LuaFactory;
}

let factoryPromise: Promise<InstanceType<LuaFactoryConstructor>> | undefined;

function getFactory(): Promise<InstanceType<LuaFactoryConstructor>> {
  factoryPromise ??= Promise.resolve(new (resolveLuaFactory())(wasmUrl));
  return factoryPromise;
}

function luaLiteral(value: unknown): string {
  if (value === null || value === undefined) return "nil";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  if (Array.isArray(value)) return `{${value.map(luaLiteral).join(",")}}`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `[${luaLiteral(key)}]=${luaLiteral(item)}`)
      .join(",")}}`;
  }
  return "nil";
}

function parseJson(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

const PRELUDE = `
io = nil
os = nil
package = nil
dofile = nil
loadfile = nil
load = nil
debug = nil
collectgarbage = nil

local function json_encode(value)
  local kind = type(value)
  if value == nil then return "null" end
  if kind == "boolean" then return value and "true" or "false" end
  if kind == "number" then
    if value ~= value or value == math.huge or value == -math.huge then return "null" end
    return tostring(value)
  end
  if kind == "string" then
    return '"' .. value:gsub("\\\\", "\\\\\\\\"):gsub('"', '\\\\"'):gsub("\\n", "\\\\n"):gsub("\\r", "\\\\r"):gsub("\\t", "\\\\t") .. '"'
  end
  if kind == "table" then
    local n = #value
    local array = n > 0
    if array then
      for k, _ in pairs(value) do
        if type(k) ~= "number" then array = false break end
      end
    end
    if array then
      local parts = {}
      for i = 1, n do parts[i] = json_encode(value[i]) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    local parts = {}
    for k, v in pairs(value) do
      parts[#parts + 1] = json_encode(tostring(k)) .. ":" .. json_encode(v)
    end
    return "{" .. table.concat(parts, ",") .. "}"
  end
  return "null"
end

print = function(...)
  local parts = {}
  for i = 1, select("#", ...) do
    parts[i] = tostring(select(i, ...))
  end
  __sim_log(table.concat(parts, "\\t"))
end

function require(name)
  local mod = __cubemax_modules[name]
  if not mod then error("module '" .. tostring(name) .. "' not found") end
  return mod
end

__cubemax_modules = {}

__cubemax_modules.runtime = {
  now_ms = function()
    return __sim_now()
  end,
  sleep = function(ms)
    coroutine.yield({ k = "sleep", ms = math.max(0, math.floor(tonumber(ms) or 0)) })
  end,
  sleep_until = function(deadline)
    local remain = math.floor(tonumber(deadline) or 0) - __sim_now()
    if remain > 0 then
      coroutine.yield({ k = "sleep", ms = remain })
    end
  end,
  cancelled = function()
    return __sim_cancelled() == true
  end,
}

__cubemax_modules.device = {
  set_brightness = function(value)
    __sim_emit("set_brightness", json_encode({ value = tonumber(value) or 0 }))
  end,
  set_volume = function(value)
    __sim_emit("set_volume", json_encode({ value = tonumber(value) or 0 }))
  end,
  vibrate = function(ms)
    __sim_emit("vibrate", json_encode({ durationMs = tonumber(ms) or 300 }))
  end,
  notify = function(text)
    __sim_emit("notify", json_encode({ text = tostring(text or "") }))
  end,
}

__cubemax_modules.alert = {
  show = function(text)
    __sim_emit("alert_show", json_encode({ text = tostring(text or "") }))
  end,
}

__cubemax_modules.camera = {
  explain = function(question)
    local q = tostring(question or "描述这张图片")
    local answer = "仿真摄像头：没有真实画面。问题是：" .. q
    __sim_emit("camera_explain", json_encode({ question = q, answer = answer }))
    return answer
  end,
  capture = function(question)
    return require("camera").explain(question)
  end,
}

__cubemax_modules.audio = {
  play = function(source)
    __sim_emit("audio_play", json_encode({ source = tostring(source or "") }))
    return 1
  end,
  play_bytes = function()
    __sim_emit("audio_play_bytes", "{}")
    return 1
  end,
  stop = function() end,
  stop_all = function() end,
  is_playing = function()
    return false
  end,
}

__cubemax_modules.http = {
  request = function(opts)
    opts = opts or {}
    __sim_emit("http_request", json_encode({ method = tostring(opts.method or "GET"), url = tostring(opts.url or "") }))
    return { status = 0, body = "", headers = {} }
  end,
  get = function(url)
    return require("http").request({ method = "GET", url = url })
  end,
  post = function(url)
    return require("http").request({ method = "POST", url = url })
  end,
}

__cubemax_modules.uart = {
  open = function()
    error("uart is not available in the browser simulator")
  end,
}

local function opts_table(a, b)
  if type(a) == "table" and b == nil then return a end
  if type(a) == "number" and type(b) == "table" then
    if b.parent == nil then b.parent = a end
    return b
  end
  error("ui widget expects a table, or (parent, table)")
end

__cubemax_modules.ui = {
  screen = function(opts)
    return __sim_ui("screen", json_encode(opts or {}))
  end,
  screen_size = function()
    return ${CLAW4_SCREEN_WIDTH}, ${CLAW4_SCREEN_HEIGHT}
  end,
  load = function(id)
    __sim_ui("load", json_encode({ id = id }))
  end,
  label = function(a, b)
    return __sim_ui("label", json_encode(opts_table(a, b)))
  end,
  button = function(a, b)
    return __sim_ui("button", json_encode(opts_table(a, b)))
  end,
  rect = function(a, b)
    return __sim_ui("rect", json_encode(opts_table(a, b)))
  end,
  circle = function(a, b)
    return __sim_ui("circle", json_encode(opts_table(a, b)))
  end,
  line = function(a, b)
    return __sim_ui("line", json_encode(opts_table(a, b)))
  end,
  arc = function(a, b)
    return __sim_ui("arc", json_encode(opts_table(a, b)))
  end,
  image = function(a, b)
    return __sim_ui("image", json_encode(opts_table(a, b)))
  end,
  set_text = function(id, text)
    __sim_ui("set_text", json_encode({ id = id, text = tostring(text or "") }))
  end,
  update = function(id, opts)
    if id == nil then return end
    __sim_ui("update", json_encode({ id = id, opts = opts or {} }))
  end,
  delete = function(id)
    __sim_ui("delete", json_encode({ id = id }))
  end,
  poll_event = function(timeout)
    local ev = coroutine.yield({ k = "poll", timeout = math.max(0, math.floor(tonumber(timeout) or 0)) })
    if ev == nil or ev == false then return nil end
    return ev
  end,
}

function __sim_step()
  local ok, a = coroutine.resume(__co, __sim_resume)
  __sim_resume = nil
  if not ok then error(a) end
  if coroutine.status(__co) == "dead" then
    return json_encode({ done = true })
  end
  if type(a) ~= "table" then
    return json_encode({ done = true })
  end
  return json_encode(a)
end
`;

function applyUi(host: DisplayHost, name: string, payload: unknown): number | void {
  const opts = parseJson(payload);
  switch (name) {
    case "screen":
      return host.screen(opts);
    case "load":
      host.load(Number(opts.id));
      return;
    case "label":
      return host.label(opts);
    case "button":
      return host.button(opts);
    case "rect":
      return host.rect(opts);
    case "circle":
      return host.circle(opts);
    case "line":
      return host.line(opts);
    case "arc":
      return host.arc(opts);
    case "image":
      return host.image(opts);
    case "set_text":
      host.setText(Number(opts.id), String(opts.text ?? ""));
      return;
    case "update":
      host.update(Number(opts.id), opts.opts);
      return;
    case "delete":
      host.delete(Number(opts.id));
      return;
    default:
      throw new Error(`unknown ui op ${name}`);
  }
}

export async function runBrowserLua(options: {
  code: string;
  params: Record<string, unknown>;
  host: DisplayHost;
  cancelled: () => boolean;
  onLog: (line: string) => void;
  onOperation: (operation: SimDeviceOperation) => void;
}): Promise<void> {
  const lua = await (await getFactory()).createEngine({
    openStandardLibs: true,
    injectObjects: false,
    enableProxy: false,
  });

  const run = (script: string) => lua.doStringSync(script) as unknown;

  try {
    lua.global.set("__sim_log", (line: string) => options.onLog(String(line ?? "")));
    lua.global.set("__sim_now", () => options.host.nowMs());
    lua.global.set("__sim_cancelled", () => options.cancelled());
    lua.global.set("__sim_emit", (action: string, json: string) => {
      options.onLog(`[sim] ${action}`);
      options.onOperation({ action: String(action), args: parseJson(json) });
    });
    lua.global.set("__sim_ui", (name: string, json: string) => applyUi(options.host, String(name), json));

    run(`${PRELUDE}
params = ${luaLiteral(options.params)}
args = params
${options.code}

if type(main) ~= "function" then
  error("脚本必须定义 main(params) 函数")
end
__co = coroutine.create(function()
  main(params)
end)
__sim_resume = nil
`);

    while (!options.cancelled()) {
      const yielded = parseJson(run("return __sim_step()"));
      if (yielded.done) break;
      if (yielded.k === "sleep") {
        await sleepWhile(Math.max(0, Number(yielded.ms) || 0), options.cancelled);
        continue;
      }
      if (yielded.k === "poll") {
        const timeout = Math.max(0, Number(yielded.timeout) || 0);
        const event = options.cancelled()
          ? null
          : await options.host.waitPoll(timeout, options.cancelled);
        if (!event) {
          run("__sim_resume = nil");
        } else {
          run(`__sim_resume = {
            object = ${event.object},
            id = ${JSON.stringify(event.id)},
            type = ${JSON.stringify(event.type)},
            x = ${event.x},
            y = ${event.y},
            dx = ${event.dx},
            dy = ${event.dy},
            time_ms = ${event.time_ms},
            pointer = 0
          }`);
        }
      }
    }
  } finally {
    lua.global.close();
  }
}

function sleepWhile(ms: number, cancelled: () => boolean): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (cancelled() || performance.now() - started >= ms) {
        resolve();
        return;
      }
      window.setTimeout(tick, Math.min(16, ms));
    };
    tick();
  });
}

export type { SimDeviceOperation, SimUiEvent };
