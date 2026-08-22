/** CubeCat 屏幕像素：宽 480，高 800。竖屏，不要对调。 */
export const CLAW4_SCREEN_WIDTH = 480;
export const CLAW4_SCREEN_HEIGHT = 800;

export const DEVICE_LOG_PREFIX = "[CubeMax:device]";

export const GRAPHICS_DEMO_ID = "__builtin_graphics";

export const GRAPHICS_DEMO_CODE = `local runtime = require("runtime")
local ui = require("ui")

function main(params)
  local screen = ui.screen({ background = 0x101418 })
  local width, height = ui.screen_size()

  ui.line({
    parent = screen,
    points = {
      { x = 0, y = height - 42 },
      { x = width, y = height - 42 },
    },
    color = 0x768390,
    width = 3,
  })

  local ball = ui.circle({
    parent = screen,
    x = 24,
    y = height - 70,
    radius = 14,
    color = 0xffc857,
    event_id = "ball",
  })

  local title = ui.label({
    parent = screen,
    x = 18,
    y = 18,
    text = tostring(params.title or "CubeCat 仿真"),
    color = 0xffffff,
  })

  local arc = ui.arc({
    parent = screen,
    x = width - 82,
    y = 18,
    width = 62,
    height = 62,
    start_angle = 0,
    end_angle = 45,
    color = 0x40c9a2,
    line_width = 6,
  })

  ui.load(screen)

  local started = runtime.now_ms()
  local next_frame = started
  while not runtime.cancelled() do
    local event = ui.poll_event(0)
    if event and event.id == "ball" and (event.type == "pressed" or event.type == "moved") then
      ui.update(ball, { x = event.x - 14, y = event.y - 14 })
    end

    local elapsed = runtime.now_ms() - started
    local phase = elapsed % 2000
    local angle = math.floor((elapsed % 3600) / 10)
    local end_angle = math.floor(45 + phase * 270 / 2000)

    ui.update(arc, { end_angle = end_angle })
    ui.set_text(title, tostring(params.title or "CubeCat 仿真") .. "  " .. tostring(angle))

    next_frame = next_frame + 33
    runtime.sleep_until(next_frame)
  end

  return { ok = true, width = width, height = height }
end
`;

export type SimulatorDraft = {
  name: string;
  moduleId?: string;
  code: string;
  params: Record<string, unknown>;
};

export const GRAPHICS_DEMO_DRAFT: SimulatorDraft = {
  name: "图形演示",
  moduleId: GRAPHICS_DEMO_ID,
  code: GRAPHICS_DEMO_CODE,
  params: { title: "CubeCat" },
};

export function luaLiteral(value: unknown): string {
  if (value === null || value === undefined) return "nil";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const encoded = Array.from(value, (character) => {
      if (character === "\\") return "\\\\";
      if (character === '"') return '\\"';
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint < 32 ? `\\${codePoint.toString().padStart(3, "0")}` : character;
    }).join("");
    return `"${encoded}"`;
  }
  if (Array.isArray(value)) return `{${value.map(luaLiteral).join(",")}}`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `[${luaLiteral(key)}]=${luaLiteral(item)}`)
      .join(",")}}`;
  }
  return "nil";
}

export function claw4BrowserPrelude(params: Record<string, unknown>): string {
  return [
    `local __cubemax_params = ${luaLiteral(params)}`,
    "args = __cubemax_params",
    "params = __cubemax_params",
    "local __native_require = require",
    "local __modules = {}",
    `local __device_log_prefix = ${luaLiteral(DEVICE_LOG_PREFIX)}`,
    "local __json = __native_require and __native_require(\"json\") or nil",
    "local function __emit(action, args)",
    "  local payload = { action = action, args = args }",
    "  if __json and __json.encode then",
    "    print(__device_log_prefix .. __json.encode(payload))",
    "  else",
    "    print(__device_log_prefix .. '{\"action\":\"' .. tostring(action) .. '\"}')",
    "  end",
    "end",
    "function require(name)",
    "  local loaded = __modules[name]",
    "  if type(loaded) == \"table\" then return loaded end",
    "  if type(loaded) == \"function\" then",
    "    loaded = loaded()",
    "    __modules[name] = loaded",
    "    return loaded",
    "  end",
    "  if __native_require then return __native_require(name) end",
    "  error(\"module '\" .. tostring(name) .. \"' not found\")",
    "end",
    "local function __register(name, factory) __modules[name] = factory end",
    BROWSER_CLAW4_MODULES,
  ].join("\n");
}

export function claw4BrowserEpilogue(): string {
  return [
    "",
    'if type(main) ~= "function" then',
    '  error("脚本必须定义 main(params) 函数")',
    "end",
    "main(__cubemax_params)",
  ].join("\n");
}

export function executableClaw4Lua(draft: SimulatorDraft): string {
  return `${claw4BrowserPrelude(draft.params)}\n${draft.code}\n${claw4BrowserEpilogue()}`;
}

const BROWSER_CLAW4_MODULES = `
local SCREEN_W = 480 -- 宽
local SCREEN_H = 800 -- 高
local UI_MAX_OBJECTS = 64

local function clamp(value, min_value, max_value)
  if value < min_value then return min_value end
  if value > max_value then return max_value end
  return value
end

local monotonic_ms = 0
local delay_mod
do
  local ok, mod = pcall(function()
    if __native_require then return __native_require("delay") end
  end)
  if ok then delay_mod = mod end
end

local lvgl_mod
local lvgl_ready = false
local function get_lvgl()
  if lvgl_mod then return lvgl_mod end
  if not __native_require then error("lvgl is not available") end
  lvgl_mod = __native_require("lvgl")
  return lvgl_mod
end

local function ensure_lvgl()
  if lvgl_ready then return get_lvgl() end
  local lvgl = get_lvgl()
  lvgl.init({
    buffer_lines = 20,
    tick_ms = 5,
    task_period_ms = 10,
    font_path = "fonts/NotoSansSC-Regular-sub.ttf",
    font_size = 22,
  })
  lvgl_ready = true
  return lvgl
end

local function pump(ms)
  local lvgl = lvgl_mod or (pcall(get_lvgl) and lvgl_mod)
  local slice = math.max(0, math.floor(ms or 0))
  if lvgl and lvgl.process_events then
    pcall(lvgl.process_events, slice)
  elseif delay_mod and delay_mod.delay_ms then
    pcall(delay_mod.delay_ms, slice)
  end
  monotonic_ms = monotonic_ms + slice
end

__register("runtime", function()
  return {
    now_ms = function()
      return monotonic_ms
    end,
    sleep = function(ms)
      local remaining = math.max(0, math.floor(tonumber(ms) or 0))
      while remaining > 0 do
        local slice = remaining > 50 and 50 or remaining
        pump(slice)
        remaining = remaining - slice
      end
    end,
    sleep_until = function(deadline)
      local runtime = require("runtime")
      local remain = math.floor(tonumber(deadline) or 0) - runtime.now_ms()
      if remain > 0 then runtime.sleep(remain) end
    end,
    cancelled = function()
      return false
    end,
  }
end)

__register("device", function()
  return {
    set_brightness = function(value)
      __emit("set_brightness", { value = clamp(math.floor(tonumber(value) or 0), 0, 100) })
    end,
    set_volume = function(value)
      __emit("set_volume", { value = clamp(math.floor(tonumber(value) or 0), 0, 100) })
    end,
    vibrate = function(ms)
      local duration = tonumber(ms) or 300
      if duration < 0 then duration = 0 end
      if duration > 5000 then duration = 5000 end
      __emit("vibrate", { durationMs = math.floor(duration) })
    end,
    notify = function(text)
      __emit("notify", { text = tostring(text or "") })
    end,
  }
end)

__register("speech", function()
  return {
    say = function(text)
      __emit("speech_say", { text = tostring(text or "") })
    end,
  }
end)

__register("camera", function()
  return {
    explain = function(question)
      local q = tostring(question or "描述这张图片")
      local answer = "仿真摄像头：没有真实画面。问题是：" .. q
      __emit("camera_explain", { question = q, answer = answer })
      return answer
    end,
    capture = function(question)
      return require("camera").explain(question)
    end,
  }
end)

__register("audio", function()
  local next_handle = 1
  local playing = {}
  return {
    play = function(source, opts)
      opts = opts or {}
      local handle = next_handle
      next_handle = next_handle + 1
      playing[handle] = true
      __emit("audio_play", { source = tostring(source or ""), volume = opts.volume or 80, loop = opts.loop == true, handle = handle })
      return handle
    end,
    play_bytes = function(_, opts)
      opts = opts or {}
      local handle = next_handle
      next_handle = next_handle + 1
      playing[handle] = true
      __emit("audio_play_bytes", { volume = opts.volume or 80, loop = opts.loop == true, handle = handle })
      return handle
    end,
    stop = function(handle)
      playing[handle] = nil
      __emit("audio_stop", { handle = handle })
    end,
    stop_all = function()
      playing = {}
      __emit("audio_stop_all", {})
    end,
    is_playing = function(handle)
      return playing[handle] == true
    end,
  }
end)

__register("http", function()
  local function mock_response(method, url)
    __emit("http_request", { method = method, url = tostring(url or "") })
    return {
      status = 200,
      body = "{\\"ok\\":true,\\"simulated\\":true}",
      headers = { ["content-type"] = "application/json" },
    }
  end
  return {
    request = function(opts)
      opts = opts or {}
      return mock_response(string.upper(tostring(opts.method or "GET")), opts.url)
    end,
    get = function(url)
      return mock_response("GET", url)
    end,
    post = function(url)
      return mock_response("POST", url)
    end,
  }
end)

__register("uart", function()
  return {
    open = function()
      error("uart is not registered on this CubeCat board")
    end,
  }
end)

__register("ui", function()
  local objects = {}
  local events = {}
  local next_id = 1
  local screen_id = nil
  local object_count = 0

  local function find(id)
    return objects[id]
  end

  local function enqueue(entry)
    if #events >= 24 then table.remove(events, 1) end
    events[#events + 1] = entry
  end

  local function bind_events(entry)
    local obj = entry.obj
    if not obj or type(obj.on) ~= "function" then return end
    local function push(event_type)
      obj:on(event_type, function()
        local x, y = 0, 0
        if type(obj.get_pos) == "function" then
          local px, py = obj:get_pos()
          x = tonumber(px) or 0
          y = tonumber(py) or 0
        end
        enqueue({
          object = entry.id,
          id = entry.event_id,
          type = event_type == "pressing" and "moved" or event_type,
          x = x,
          y = y,
          dx = 0,
          dy = 0,
          time_ms = monotonic_ms,
          pointer = 0,
        })
      end)
    end
    pcall(push, "pressed")
    pcall(push, "released")
    pcall(push, "clicked")
    pcall(push, "pressing")
  end

  local function add_object(type_name, obj, event_id)
    if object_count >= UI_MAX_OBJECTS then
      error("ui object limit reached")
    end
    local id = next_id
    next_id = next_id + 1
    object_count = object_count + 1
    local entry = { id = id, type = type_name, obj = obj, event_id = event_id or "" }
    objects[id] = entry
    if event_id then bind_events(entry) end
    return id
  end

  local function opts_table(a, b)
    if type(a) == "table" and b == nil then return a end
    if type(a) == "number" and type(b) == "table" then
      if b.parent == nil then b.parent = a end
      return b
    end
    error("ui widget expects a table, or (parent, table)")
  end

  local function parent_obj(opts)
    local parent_id = opts.parent
    if type(parent_id) == "number" then
      local parent = find(parent_id)
      if not parent then error("invalid parent object") end
      return parent.obj
    end
    if screen_id then
      local screen = find(screen_id)
      if screen then return screen.obj end
    end
    error("ui.screen() must be called first")
  end

  local function color_of(opts, field, default_value)
    local value = opts[field]
    if type(value) == "number" then return value end
    return default_value
  end

  return {
    screen = function(opts)
      opts = opts or {}
      if type(opts) ~= "table" then error("ui.screen expects a table") end
      if screen_id then error("a Lua VM can own only one screen") end
      local lvgl = ensure_lvgl()
      local scr = lvgl.create_screen()
      pcall(function()
        scr:set_style({ bg_color = color_of(opts, "background", 0x101418) })
      end)
      screen_id = add_object("screen", scr, "screen")
      bind_events(objects[screen_id])
      return screen_id
    end,
    screen_size = function()
      pcall(ensure_lvgl)
      return SCREEN_W, SCREEN_H
    end,
    load = function(id)
      local entry = find(id or screen_id)
      if not entry or not entry.obj then error("invalid screen") end
      if type(entry.obj.load) == "function" then
        entry.obj:load()
      end
      pump(0)
    end,
    label = function(a, b)
      local opts = opts_table(a, b)
      local lvgl = ensure_lvgl()
      local obj = lvgl.label(parent_obj(opts), {
        text = tostring(opts.text or ""),
        x = opts.x or 0,
        y = opts.y or 0,
        w = opts.width,
        text_color = color_of(opts, "color", 0xffffff),
      })
      return add_object("label", obj)
    end,
    button = function(a, b)
      local opts = opts_table(a, b)
      local lvgl = ensure_lvgl()
      local obj = lvgl.button(parent_obj(opts), {
        text = tostring(opts.text or "Button"),
        x = opts.x or 0,
        y = opts.y or 0,
        w = opts.width,
        h = opts.height,
        bg_color = color_of(opts, "color", 0x2563eb),
        text_color = color_of(opts, "text_color", 0xffffff),
        radius = opts.radius or 6,
      })
      local id = add_object("button", obj, opts.event_id or "button")
      bind_events(objects[id])
      return id
    end,
    rect = function(a, b)
      local opts = opts_table(a, b)
      local lvgl = ensure_lvgl()
      local obj = lvgl.object(parent_obj(opts), {
        x = opts.x or 0,
        y = opts.y or 0,
        w = opts.width or 40,
        h = opts.height or 40,
        bg_color = color_of(opts, "color", 0x30363d),
        radius = opts.radius or 0,
        border_width = 0,
      })
      local id = add_object("rect", obj, opts.event_id)
      if opts.event_id then bind_events(objects[id]) end
      return id
    end,
    circle = function(a, b)
      local opts = opts_table(a, b)
      local radius = tonumber(opts.radius) or 10
      if radius <= 0 then error("radius must be positive") end
      local lvgl = ensure_lvgl()
      local obj = lvgl.object(parent_obj(opts), {
        x = opts.x or 0,
        y = opts.y or 0,
        w = radius * 2,
        h = radius * 2,
        bg_color = color_of(opts, "color", 0xffffff),
        radius = radius,
        opa = opts.opacity or 255,
        border_width = 0,
      })
      local id = add_object("circle", obj, opts.event_id)
      if opts.event_id then bind_events(objects[id]) end
      return id
    end,
    line = function(a, b)
      local opts = opts_table(a, b)
      local lvgl = ensure_lvgl()
      local obj = lvgl.line(parent_obj(opts), {
        points = opts.points or {},
        line_color = color_of(opts, "color", 0xffffff),
        line_width = opts.width or opts.line_width or 1,
      })
      return add_object("line", obj, opts.event_id)
    end,
    arc = function(a, b)
      local opts = opts_table(a, b)
      local lvgl = ensure_lvgl()
      local obj = lvgl.arc(parent_obj(opts), {
        x = opts.x or 0,
        y = opts.y or 0,
        w = opts.width or 72,
        h = opts.height or 72,
        start_angle = opts.start_angle or 0,
        end_angle = opts.end_angle or 360,
        arc_width = opts.line_width or 6,
        bg_color = color_of(opts, "color", 0x20c997),
      })
      pcall(function()
        obj:set_style({
          arc_width = opts.line_width or 6,
          line_color = color_of(opts, "color", 0x20c997),
        })
      end)
      return add_object("arc", obj, opts.event_id)
    end,
    image = function(a, b)
      local opts = opts_table(a, b)
      local lvgl = ensure_lvgl()
      local obj
      local ok, created = pcall(lvgl.image, parent_obj(opts), {
        src = tostring(opts.src or ""),
        x = opts.x or 0,
        y = opts.y or 0,
        opa = opts.opacity or 255,
      })
      if ok then
        obj = created
      else
        obj = lvgl.object(parent_obj(opts), {
          x = opts.x or 0,
          y = opts.y or 0,
          w = 44,
          h = 44,
          bg_color = 0x30363d,
        })
      end
      return add_object("image", obj, opts.event_id)
    end,
    set_text = function(id, text)
      local entry = find(id)
      if not entry or entry.type ~= "label" then error("object is not a label") end
      if type(entry.obj.set_text) == "function" then
        entry.obj:set_text(tostring(text or ""))
      end
    end,
    update = function(id, opts)
      if id == nil then
        pump(0)
        return
      end
      if type(opts) ~= "table" then error("ui.update expects (object, options)") end
      local entry = find(id)
      if not entry then error("invalid UI object") end
      local obj = entry.obj
      if opts.x ~= nil or opts.y ~= nil then
        local x, y = 0, 0
        if type(obj.get_pos) == "function" then
          x, y = obj:get_pos()
        end
        if type(obj.set_pos) == "function" then
          obj:set_pos(opts.x ~= nil and opts.x or x, opts.y ~= nil and opts.y or y)
        end
      end
      if opts.width ~= nil or opts.height ~= nil then
        local w, h = 0, 0
        if type(obj.get_size) == "function" then
          w, h = obj:get_size()
        end
        if type(obj.set_size) == "function" then
          obj:set_size(opts.width ~= nil and opts.width or w, opts.height ~= nil and opts.height or h)
        end
      end
      if opts.text ~= nil and type(obj.set_text) == "function" then
        obj:set_text(tostring(opts.text))
      end
      local style = {}
      if opts.color ~= nil then
        if entry.type == "label" then
          style.text_color = opts.color
        else
          style.bg_color = opts.color
          style.line_color = opts.color
        end
      end
      if opts.opacity ~= nil then style.opa = opts.opacity end
      if next(style) and type(obj.set_style) == "function" then
        pcall(obj.set_style, obj, style)
      end
      if opts.end_angle ~= nil or opts.start_angle ~= nil then
        pcall(function()
          if opts.start_angle ~= nil and obj.set_angles then
            obj:set_angles(opts.start_angle, opts.end_angle or opts.start_angle)
          end
        end)
      end
      pump(0)
    end,
    delete = function(id)
      local entry = find(id)
      if not entry then error("invalid UI object") end
      if entry.type == "screen" then error("the owned screen cannot be deleted") end
      if type(entry.obj.delete) == "function" then pcall(entry.obj.delete, entry.obj) end
      objects[id] = nil
      object_count = object_count - 1
    end,
    poll_event = function(timeout_ms)
      timeout_ms = math.floor(tonumber(timeout_ms) or 0)
      if timeout_ms < 0 then timeout_ms = 0 end
      local deadline = monotonic_ms + timeout_ms
      while true do
        pump(0)
        if #events > 0 then
          local event = table.remove(events, 1)
          return event
        end
        if timeout_ms == 0 or monotonic_ms >= deadline then
          return nil
        end
        local remain = deadline - monotonic_ms
        pump(remain > 50 and 50 or remain)
      end
    end,
  }
end)
`;
