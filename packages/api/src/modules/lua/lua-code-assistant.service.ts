import { getProvider, getReasoningOptions } from "@buildingai/ai-sdk";
import { SecretService } from "@buildingai/core/modules";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiModel } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { getProviderSecret } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";
import { generateText, Output } from "ai";
import { z } from "zod";

import type { GenerateLuaModuleDto } from "./lua-module.dto";

const jsonObjectSchema = z.record(z.string(), z.unknown());

const generatedModuleSchema = z.object({
    reply: z.string().describe("面向学生的简短中文回复，说明本轮完成了什么"),
    name: z.string().min(1).max(100).describe("模块名称"),
    description: z.string().max(500).describe("模块用途说明"),
    draftCode: z.string().min(1).max(65536).describe("完整可执行的 Lua 5.4 代码"),
    inputSchema: jsonObjectSchema.describe("完整的输入 JSON Schema，根类型必须是 object"),
    outputSchema: jsonObjectSchema.describe("完整的输出 JSON Schema，根类型必须是 object"),
    testParams: jsonObjectSchema.describe("一组与输入 Schema 匹配的测试参数"),
});

export type GeneratedLuaModule = z.infer<typeof generatedModuleSchema>;

const SIMULATOR_SYSTEM_PROMPT = `你是面向学生的 Lua 模块编程助手。你需要根据对话和当前草稿，返回一份完整的模块快照。

目标：ESP-Claw Web 仿真器（虚拟 ESP32，虚拟屏幕 800x480）。

运行环境约束：
- 使用 Lua 5.4 语法，必须定义 function main(params)，并返回一个 JSON 兼容的 table。
- 默认可使用基础 Lua、string、table、math、utf8。不能使用 os、io、package、dofile、loadfile、load、debug、collectgarbage。
- 当学生明确要制作屏幕界面、小游戏、仪表盘、触摸交互或动画时，可以使用 ESP-Claw Web 仿真提供的 require("lvgl")、require("display")、require("lcd_touch")、require("delay")、require("board_manager") 和 print。虚拟屏幕默认是 800x480，代码仍必须放在 main(params) 中。
- 屏幕仿真和外设仿真属于同一个虚拟 ESP32。屏幕程序中可直接同时使用 device.gpio_set_mode、device.gpio_write、device.gpio_read、device.analog_read、device.pwm_write、device.servo_write_angle、device.serial_write、device.button_pressed 和 device.potentiometer_value；不要 require device。这样屏幕、LED、按键、电位器、蜂鸣器、舵机和串口会在同一个硬件仿真界面联动。
- LVGL 必须使用当前 Web 运行时兼容的旧版初始化签名：先通过 board_manager.get_display_lcd_params("display_lcd") 获取 panel、io、width、height、panel_if，再调用 lvgl.init(panel, io, width, height, panel_if, { buffer_lines = 10, tick_ms = 5, task_period_ms = 10, font_path = "fonts/NotoSansSC-Regular-sub.ttf" })。之后使用 lvgl.create_screen()、lvgl.label(parent, opts)、lvgl.button(parent, opts)、对象:set_style()、对象:on()、screen:load()。触摸界面通过 board_manager.get_lcd_touch_handle("lcd_touch") 和 lvgl.indev_register("touch", handle) 注册，最后调用 lvgl.run() 保持交互。不要生成只传一个配置 table 的 lvgl.init，也不要生成 lv_obj_create、lv_label_create、lvgl.scr_act 等原生 C 风格 API。
- 除上面列出的教学仿真模块外，不要 require 任何其他模块；不要访问网络、文件、系统命令或环境变量。
- 输入输出只能包含字符串、有限数字、布尔值、数组、对象和 nil，不能返回函数、userdata、线程或循环引用。
- 代码要简洁、适合初学者阅读；对缺失输入提供合理默认值，需要时用 error 给出清楚错误。
- inputSchema 和 outputSchema 必须是根 type 为 object 的 JSON Schema，并与代码严格一致。
- testParams 必须能够直接运行当前代码。

- 物理 ESP32 设备使用完全不同的 API（xiaozhi.* 与 xiaozhi.ui），Web 仿真代码（require("lvgl")、board_manager、device.*）在物理设备上不存在。若学生明确要求“运行到物理设备/ESP32 上显示”，应提示其在页面选择物理设备，或按设备目标提示词生成。

编辑规则：
- 用户要求修改时，在当前草稿上修改；未要求改变的行为应保留。
- 用户只是询问或让你解释时，reply 回答问题，模块快照保持不变。
- 对屏幕类需求，优先生成简洁、可触摸的 LVGL 界面，并在 reply 中提示学生可点击“虚拟屏幕运行”查看效果。
- reply 使用简短中文，不要输出 Markdown 代码块；代码只放在 draftCode 字段。`;

const DEVICE_SYSTEM_PROMPT = `你是面向学生的 XiaoZhi ESP32 设备 Lua 脚本编程助手。你需要根据对话和当前草稿，返回一份完整的脚本快照。

目标：物理 ESP32 设备（固件通过 WebSocket 云端下发脚本，设备上只执行一次 main(params)，返回一个 JSON 兼容的 table）。

运行环境约束：
- 使用 Lua 5.5 语法，必须定义 function main(params)，并返回一个 JSON 兼容的 table。
- 可使用基础 Lua、print、table、string、math、utf8 以及 xiaozhi 模块。不能使用 os、io、package、dofile、loadfile、load、debug、collectgarbage。
- xiaozhi 模块的设备 API：
  - xiaozhi.log(msg) 写入运行日志。
  - xiaozhi.get_state() 获取设备当前状态。
  - xiaozhi.notify(msg) 在设备端发送文字通知。
  - xiaozhi.set_emotion(name) 设置设备表情。
  - xiaozhi.start_listening() / xiaozhi.stop_listening() 开始/停止语音聆听。
- 带 LVGL 显示屏的设备额外提供显示 API xiaozhi.ui（对应 display capability）。生成显示脚本前先用 ui.info() 判断：
  - ui.info() 返回 { available, width, height }；available 为 false 表示该设备无屏幕。
  - ui.screen(options) 创建新屏幕并返回屏幕对象；options 可设 bg_color 等。
  - 控件工厂（第一个参数是父控件，第二个是选项表）：ui.container、ui.label、ui.button、ui.bar、ui.slider、ui.arc、ui.switch、ui.checkbox、ui.dropdown、ui.roller、ui.textarea、ui.image、ui.line、ui.table、ui.spinner、ui.led、ui.chart。
  - 通用创建：ui.create(type, parent, options)，等价于对应的命名工厂。
  - 对象方法：object:set(options) 更新属性、object:load()（仅屏幕）加载显示、object:delete() 删除控件。
  - ui.restore() 恢复 XiaoZhi 原生界面。
  - ui.poll_event(timeout_ms) 轮询交互事件（每次最多等待 1000ms），返回 nil 或 { id, type, value, checked, text }。
  - 常用选项：id、text、x、y、width、height、align、bg_color、text_color、border_color、bg_opa、radius、border_width、pad、pad_row、pad_column、hidden、clickable、scrollable、flex、min、max、value、checked、options、src、points、events。
  - 交互控件需设 events = true，再通过 ui.poll_event() 读取 clicked、value_changed 等事件。
  - 屏幕在 main 返回后仍然保持显示；不要初始化 LCD/面板，不要启动第二个 LVGL 任务。
- 严禁使用 Web 仿真器专用 API：require("lvgl")、require("board_manager")、require("display")、lvgl.init/lvgl.run、device.gpio_*、device.servo_write_angle 等在物理设备上不存在。
- 不要 require 其他模块，不要访问网络、文件、系统命令或环境变量。
- 输入输出只能包含字符串、有限数字、布尔值、数组、对象和 nil，不能返回函数、userdata、线程或循环引用。
- 代码要简洁、适合初学者阅读；对缺失输入提供合理默认值，需要时用 error 给出清楚错误。
- inputSchema 和 outputSchema 必须是根 type 为 object 的 JSON Schema，并与代码严格一致。
- testParams 必须能够直接运行当前代码。

编辑规则：
- 用户要求修改时，在当前草稿上修改；未要求改变的行为应保留。
- 用户只是询问或让你解释时，reply 回答问题，脚本快照保持不变。
- 对显示类需求，优先生成简洁、可用的 xiaozhi.ui 界面，并在 reply 中提示学生可在页面选择物理设备运行查看效果。
- reply 使用简短中文，不要输出 Markdown 代码块；代码只放在 draftCode 字段。`;

@Injectable()
export class LuaCodeAssistantService {
    constructor(
        @InjectRepository(AiModel)
        private readonly aiModelRepository: Repository<AiModel>,
        private readonly secretService: SecretService,
    ) {}

    async generate(dto: GenerateLuaModuleDto): Promise<GeneratedLuaModule> {
        const model = await this.aiModelRepository.findOne({
            where: { id: dto.modelId, isActive: true, modelType: "llm" },
            relations: ["provider"],
        });

        if (!model?.provider?.isActive) {
            throw HttpErrorFactory.badRequest("选择的 LLM 模型不存在或未启用");
        }
        if (!model.provider.bindSecretId) {
            throw HttpErrorFactory.badRequest("选择的模型供应商尚未配置密钥");
        }

        const secret = await this.secretService.getConfigKeyValuePairs(model.provider.bindSecretId);
        const providerId = model.provider.provider;
        const provider = getProvider(providerId, {
            apiKey: getProviderSecret("apiKey", secret),
            baseURL: getProviderSecret("baseUrl", secret) || undefined,
        });

        const current = this.normalizeCurrent(dto.current);
        const history = (dto.messages ?? []).map(({ role, content }) => ({ role, content }));
        const target = dto.target === "device" ? "device" : "simulator";
        const system = target === "device" ? DEVICE_SYSTEM_PROMPT : SIMULATOR_SYSTEM_PROMPT;
        const result = await generateText({
            model: provider(model.model).model,
            output: Output.object({ schema: generatedModuleSchema }),
            system,
            prompt: `目标运行环境：${target === "device" ? "物理 ESP32 设备" : "ESP-Claw Web 仿真器"}\n最近对话：\n${JSON.stringify(history)}\n\n当前模块：\n${JSON.stringify(current)}\n\n学生本轮要求：\n${dto.message.trim()}`,
            temperature: 0.2,
            providerOptions: getReasoningOptions(providerId, { thinking: false }),
        });

        if (!result.output) {
            throw HttpErrorFactory.internal("模型没有返回可用的 Lua 模块");
        }
        this.assertGeneratedModule(result.output);
        return result.output;
    }

    private normalizeCurrent(current: GenerateLuaModuleDto["current"]) {
        return {
            name: this.stringValue(current.name, 100),
            description: this.stringValue(current.description, 500),
            draftCode: this.stringValue(current.draftCode, 65536),
            inputSchema: this.objectValue(current.inputSchema),
            outputSchema: this.objectValue(current.outputSchema),
            testParams: this.objectValue(current.testParams),
        };
    }

    private stringValue(value: unknown, maxLength: number): string {
        return typeof value === "string" ? value.slice(0, maxLength) : "";
    }

    private objectValue(value: unknown): Record<string, unknown> {
        return value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
    }

    private assertGeneratedModule(module: GeneratedLuaModule): void {
        if (!/function\s+main\s*\(/.test(module.draftCode)) {
            throw HttpErrorFactory.badRequest("模型生成的代码缺少 main(params) 函数，请重试");
        }
        if (module.inputSchema.type !== "object" || module.outputSchema.type !== "object") {
            throw HttpErrorFactory.badRequest("模型生成的输入输出定义格式不正确，请重试");
        }
    }
}
