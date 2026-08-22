import { HttpErrorFactory } from "@buildingai/errors";
import type { SpeechExecutorInput } from "@flowgram.ai/runtime-js";
import { Injectable } from "@nestjs/common";

import { LuaDeviceGatewayService } from "../lua-device/lua-device-gateway.service";

const SPEECH_SCRIPT = `function main(args)
  local speech = require("speech")
  local text = tostring(args.text or args.content or "")
  speech.say(text)
  if args.waitForComplete then
    local runtime = require("runtime")
    local ms = 400 + #text * 80
    if ms > 12000 then ms = 12000 end
    runtime.sleep(ms)
  end
  return { success = true, durationMs = 0 }
end
`;

function asText(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === undefined || value === null) return "";
    return String(value);
}

@Injectable()
export class WorkflowSpeechExecutorService {
    constructor(private readonly luaDeviceGatewayService: LuaDeviceGatewayService) {}

    async execute(input: SpeechExecutorInput): Promise<Record<string, unknown>> {
        if (!input.userId) throw HttpErrorFactory.unauthorized("语音播报节点需要登录后执行");
        if (
            input.runtimeContext?.runtimeTarget &&
            input.runtimeContext.runtimeTarget !== "device"
        ) {
            throw HttpErrorFactory.badRequest("语音播报节点需要在工程设置中把运行目标设为物理设备");
        }
        const deviceId = input.runtimeContext?.deviceId;
        if (!deviceId) throw HttpErrorFactory.badRequest("请先在工程设置中选择 CubeCat 设备");

        const text =
            asText(input.inputs.content).trim() ||
            asText(input.inputs.text).trim() ||
            asText(input.node.data?.text).trim();
        if (!text) throw HttpErrorFactory.badRequest("请填写播报内容");
        const waitForComplete = input.node.data?.waitForComplete !== false;

        const run = await this.luaDeviceGatewayService.createRun(input.userId, deviceId, {
            name: "speech",
            projectId: input.runtimeContext?.projectId,
            source: SPEECH_SCRIPT,
            params: { text, content: text, waitForComplete },
            requiredCapabilities: ["lua"],
            timeoutMs: 20_000,
        });
        const completed = await this.luaDeviceGatewayService.waitForRun(
            input.userId,
            deviceId,
            run.id,
            25_000,
        );
        if (completed.status !== "succeeded") {
            throw HttpErrorFactory.badRequest(completed.error?.message ?? "设备播报失败");
        }
        const result = completed.result;
        if (result && typeof result === "object" && !Array.isArray(result)) {
            return result as Record<string, unknown>;
        }
        return { success: true, durationMs: 0 };
    }
}
