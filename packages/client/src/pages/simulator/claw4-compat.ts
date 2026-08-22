/** CubeCat 屏幕像素：宽 480，高 800。竖屏，不要对调。 */
export const CLAW4_SCREEN_WIDTH = 480;
export const CLAW4_SCREEN_HEIGHT = 800;

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
