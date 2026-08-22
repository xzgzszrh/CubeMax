import { HttpErrorFactory } from "@buildingai/errors";
import type { VisionExecutorInput } from "@flowgram.ai/runtime-js";
import { Injectable } from "@nestjs/common";

import { LuaDeviceGatewayService } from "../lua-device/lua-device-gateway.service";

const VISION_SCRIPT = `function main(args)
  local camera = require("camera")
  local question = args.question or args.analysisPrompt or "描述这张图片"
  local res, err = camera.explain(question)
  if not res then
    return {
      success = false,
      analysisResult = tostring(err or "camera.explain failed"),
      imageUrl = "",
      detectedObjects = {},
    }
  end
  local text = res
  if type(res) == "table" then
    text = res.result or res.analysis or res.explanation or res.message or ""
  end
  return {
    success = true,
    analysisResult = tostring(text),
    imageUrl = "",
    detectedObjects = {},
  }
end
`;

function asText(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === undefined || value === null) return "";
    return String(value);
}

@Injectable()
export class WorkflowVisionExecutorService {
    constructor(private readonly luaDeviceGatewayService: LuaDeviceGatewayService) {}

    async execute(input: VisionExecutorInput): Promise<Record<string, unknown>> {
        if (!input.userId) throw HttpErrorFactory.unauthorized("视觉节点需要登录后执行");
        if (
            input.runtimeContext?.runtimeTarget &&
            input.runtimeContext.runtimeTarget !== "device"
        ) {
            throw HttpErrorFactory.badRequest("视觉节点需要在工程设置中把运行目标设为物理设备");
        }
        const deviceId = input.runtimeContext?.deviceId;
        if (!deviceId) throw HttpErrorFactory.badRequest("请先在工程设置中选择 CubeCat 设备");

        const question =
            asText(input.inputs.context).trim() ||
            asText(input.inputs.analysisPrompt).trim() ||
            asText(input.node.data?.analysisPrompt).trim() ||
            "描述这张图片";

        const run = await this.luaDeviceGatewayService.createRun(input.userId, deviceId, {
            name: "vision",
            projectId: input.runtimeContext?.projectId,
            source: VISION_SCRIPT,
            params: { question, analysisPrompt: question },
            requiredCapabilities: ["lua", "camera"],
            timeoutMs: 60_000,
        });
        const completed = await this.luaDeviceGatewayService.waitForRun(
            input.userId,
            deviceId,
            run.id,
            65_000,
        );
        if (completed.status !== "succeeded") {
            throw HttpErrorFactory.badRequest(completed.error?.message ?? "设备拍照分析失败");
        }
        const result = completed.result;
        if (result && typeof result === "object" && !Array.isArray(result)) {
            return result as Record<string, unknown>;
        }
        return {
            success: true,
            analysisResult: result == null ? "" : String(result),
            imageUrl: "",
            detectedObjects: [],
        };
    }
}
