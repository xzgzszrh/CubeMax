import { HttpErrorFactory } from "@buildingai/errors";
import type { DeviceControlExecutorInput } from "@flowgram.ai/runtime-js";
import { Injectable } from "@nestjs/common";

import { LuaDeviceGatewayService } from "../lua-device/lua-device-gateway.service";

const DEVICE_CONTROL_SCRIPT = `function main(args)
  local device = require("device")
  local action = tostring(args.action or "led_toggle")
  if action == "led_toggle" or action == "led_rgb" then
    local on = args.ledState
    if on == nil then on = true end
    device.set_brightness(on and 80 or 8)
    return { success = true, response = on and "backlight on" or "backlight dim" }
  end
  if action == "buzzer" then
    local text = tostring(args.notifyText or args.text or "beep")
    device.notify(text)
    return { success = true, response = "notified" }
  end
  if action == "motor" then
    if args.motorDirection == "stop" then
      return { success = true, response = "stopped" }
    end
    local ms = tonumber(args.durationMs) or tonumber(args.buzzerDurationMs) or 400
    device.vibrate(ms)
    return { success = true, response = "vibrated" }
  end
  return { success = false, response = "unsupported action: " .. action }
end
`;

function asText(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === undefined || value === null) return "";
    return String(value);
}

@Injectable()
export class WorkflowDeviceControlExecutorService {
    constructor(private readonly luaDeviceGatewayService: LuaDeviceGatewayService) {}

    async execute(input: DeviceControlExecutorInput): Promise<Record<string, unknown>> {
        if (!input.userId) throw HttpErrorFactory.unauthorized("设备控制节点需要登录后执行");
        if (
            input.runtimeContext?.runtimeTarget &&
            input.runtimeContext.runtimeTarget !== "device"
        ) {
            throw HttpErrorFactory.badRequest("设备控制节点需要在工程设置中把运行目标设为物理设备");
        }
        const deviceId = input.runtimeContext?.deviceId;
        if (!deviceId) throw HttpErrorFactory.badRequest("请先在工程设置中选择 CubeCat 设备");

        const data = (input.node.data ?? {}) as Record<string, unknown>;
        const inputParams = isRecord(input.inputs.params) ? input.inputs.params : {};
        const params = {
            action: asText(inputParams.action) || asText(data.action) || "led_toggle",
            ledState: inputParams.ledState ?? data.ledState,
            ledIndex: inputParams.ledIndex ?? data.ledIndex,
            notifyText: inputParams.notifyText ?? inputParams.text ?? data.notifyText,
            durationMs: inputParams.durationMs ?? data.buzzerDurationMs,
            buzzerDurationMs: inputParams.buzzerDurationMs ?? data.buzzerDurationMs,
            motorDirection: inputParams.motorDirection ?? data.motorDirection,
            motorSpeed: inputParams.motorSpeed ?? data.motorSpeed,
        };

        const run = await this.luaDeviceGatewayService.createRun(input.userId, deviceId, {
            name: "device-control",
            projectId: input.runtimeContext?.projectId,
            source: DEVICE_CONTROL_SCRIPT,
            params,
            requiredCapabilities: ["lua"],
            timeoutMs: 15_000,
        });
        const completed = await this.luaDeviceGatewayService.waitForRun(
            input.userId,
            deviceId,
            run.id,
            20_000,
        );
        if (completed.status !== "succeeded") {
            throw HttpErrorFactory.badRequest(completed.error?.message ?? "设备控制失败");
        }
        const result = completed.result;
        if (result && typeof result === "object" && !Array.isArray(result)) {
            return result as Record<string, unknown>;
        }
        return { success: true, response: result == null ? "" : String(result) };
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
