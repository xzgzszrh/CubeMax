import { randomUUID } from "node:crypto";

import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import {
    CUBECAT_SCREEN_HEIGHT,
    CUBECAT_SCREEN_WIDTH,
    createDefaultCubeCatState,
    type SimulatorBoardType,
    type SimulatorOperation,
    type SimulatorSerialEntry,
    type SimulatorSession,
    type VirtualPinMode,
    type VirtualPinState,
} from "./simulator.types";

const BOARD_DEFINITIONS: Record<SimulatorBoardType, SimulatorSession["board"]> = {
    "esp32-devkit-v1": { type: "esp32-devkit-v1", name: "ESP32 DevKit", voltage: 3.3 },
    "cubecat-s3": { type: "cubecat-s3", name: "CubeCat-S3", voltage: 3.3 },
    "cubecat-p4": { type: "cubecat-p4", name: "CubeCat-P4", voltage: 3.3 },
};

const MAX_SESSIONS_PER_USER = 10;
const MAX_SERIAL_ENTRIES = 200;
const SESSION_IDLE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SimulatorService {
    private readonly sessions = new Map<string, SimulatorSession>();
    private nextSerialEntryId = 1;

    list(userId: string, projectId?: string): SimulatorSession[] {
        this.removeExpiredSessions();
        return Array.from(this.sessions.values())
            .filter(
                (session) =>
                    session.userId === userId &&
                    (projectId === undefined || session.projectId === projectId),
            )
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    create(
        userId: string,
        name?: string,
        boardType: SimulatorBoardType = "esp32-devkit-v1",
        projectId?: string,
    ): SimulatorSession {
        const existing = this.list(userId, projectId);
        if (existing.length >= MAX_SESSIONS_PER_USER) {
            this.sessions.delete(existing.at(-1)!.id);
        }

        const now = new Date().toISOString();
        const session: SimulatorSession = {
            id: randomUUID(),
            userId,
            projectId,
            name: name?.trim() || `CubeCat 仿真 ${existing.length + 1}`,
            board: { ...BOARD_DEFINITIONS[boardType] },
            revision: 1,
            pins: {},
            peripherals: {
                led: { pin: "2", on: false },
                button: { pin: "0", pressed: false },
                potentiometer: { pin: "34", value: 2048, max: 4095 },
                buzzer: { pin: "25", active: false, frequencyHz: 0 },
                servo: { pin: "26", angle: 90 },
            },
            cubecat: createDefaultCubeCatState(),
            i2cDevices: [{ address: 0x3c, name: "OLED 128x64" }],
            serialLog: [],
            createdAt: now,
            updatedAt: now,
        };
        this.appendSerial(session, "system", "CubeCat 仿真已启动");
        this.sessions.set(session.id, session);
        return session;
    }

    getForUser(id: string, userId: string): SimulatorSession {
        const session = this.get(id);
        if (session.userId !== userId) {
            throw HttpErrorFactory.notFound("仿真会话不存在");
        }
        return session;
    }

    getForProjectUser(id: string, userId: string, projectId: string): SimulatorSession {
        const session = this.getForUser(id, userId);
        if (session.projectId !== projectId) {
            throw HttpErrorFactory.notFound("当前工程的仿真会话不存在");
        }
        return session;
    }

    removeForProject(projectId: string, userId: string): void {
        for (const [id, session] of this.sessions) {
            if (session.projectId === projectId && session.userId === userId) this.sessions.delete(id);
        }
    }

    get(id: string): SimulatorSession {
        const session = this.sessions.get(id);
        if (!session) throw HttpErrorFactory.notFound("仿真会话不存在或已过期");
        return session;
    }

    reset(id: string, userId: string): SimulatorSession {
        const current = this.getForUser(id, userId);
        return this.resetSession(current);
    }

    updateBoard(id: string, userId: string, boardType: SimulatorBoardType): SimulatorSession {
        const session = this.getForUser(id, userId);
        session.board = { ...BOARD_DEFINITIONS[boardType] };
        this.appendSerial(session, "system", `开发板型号已切换为 ${session.board.name}`);
        this.touch(session);
        return session;
    }

    remove(id: string, userId: string): void {
        this.getForUser(id, userId);
        this.sessions.delete(id);
    }

    updateInput(
        id: string,
        userId: string,
        input: { type: "button" | "potentiometer"; pressed?: boolean; value?: number },
    ): SimulatorSession {
        const session = this.getForUser(id, userId);
        if (input.type === "button") {
            const pressed = input.pressed ?? false;
            session.peripherals.button.pressed = pressed;
            this.pin(session, session.peripherals.button.pin).digitalValue = pressed;
        } else {
            const value = this.clampNumber(input.value ?? 0, 0, 4095);
            session.peripherals.potentiometer.value = value;
            this.pin(session, session.peripherals.potentiometer.pin).analogValue = value;
        }
        this.touch(session);
        return session;
    }

    writeSerialInput(id: string, userId: string, text: string): SimulatorSession {
        const session = this.getForUser(id, userId);
        this.appendSerial(session, "input", text);
        this.touch(session);
        return session;
    }

    async executeTool(
        action: string,
        args: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        if (action === "scan_serial_ports") {
            return {
                ports: Array.from(this.sessions.values()).map((session) => ({
                    port: `virtual:${session.id}`,
                    name: session.name,
                    board: session.board.name,
                })),
            };
        }

        if (action === "open_serial") {
            const port = this.stringArg(args, "port");
            const sessionId = port.startsWith("virtual:") ? port.slice("virtual:".length) : port;
            const session = this.get(sessionId);
            this.appendSerial(session, "system", "虚拟串口已连接");
            this.touch(session);
            return { sessionId: session.id, port: `virtual:${session.id}`, connected: true };
        }

        if (action === "delay_ms") {
            const durationMs = this.clampNumber(this.numberArg(args, "durationMs", 0), 0, 5000);
            await new Promise((resolve) => setTimeout(resolve, durationMs));
            return { durationMs };
        }

        const session = this.get(this.stringArg(args, "sessionId"));
        const output = this.applyOperation(session, { action, args });
        this.touch(session);
        return output;
    }

    applyOperations(sessionId: string, operations: SimulatorOperation[]): SimulatorSession {
        const session = this.get(sessionId);
        return this.applyOperationsToSession(session, operations);
    }

    applyOperationsForUser(
        sessionId: string,
        userId: string,
        operations: SimulatorOperation[],
    ): SimulatorSession {
        const session = this.getForUser(sessionId, userId);
        return this.applyOperationsToSession(session, operations);
    }

    private applyOperationsToSession(
        session: SimulatorSession,
        operations: SimulatorOperation[],
    ): SimulatorSession {
        if (operations.length > 200) {
            throw HttpErrorFactory.badRequest("单次 Lua 执行的设备操作不能超过200次");
        }
        for (const operation of operations) {
            if (
                !operation ||
                typeof operation !== "object" ||
                typeof operation.action !== "string" ||
                !operation.args ||
                typeof operation.args !== "object" ||
                Array.isArray(operation.args)
            ) {
                throw HttpErrorFactory.badRequest("虚拟设备操作格式不正确");
            }
            this.applyOperation(session, operation);
        }
        this.touch(session);
        return session;
    }

    getLuaSnapshot(sessionId: string): Record<string, unknown> {
        const session = this.get(sessionId);
        const digitalPins = Object.fromEntries(
            Object.entries(session.pins).map(([pin, state]) => [pin, state.digitalValue]),
        );
        const analogPins = Object.fromEntries(
            Object.entries(session.pins).map(([pin, state]) => [pin, state.analogValue]),
        );
        digitalPins[session.peripherals.button.pin] = session.peripherals.button.pressed;
        analogPins[session.peripherals.potentiometer.pin] = session.peripherals.potentiometer.value;
        return {
            digitalPins,
            analogPins,
            buttonPressed: session.peripherals.button.pressed,
            potentiometerValue: session.peripherals.potentiometer.value,
            cubecat: session.cubecat,
            screenWidth: CUBECAT_SCREEN_WIDTH,
            screenHeight: CUBECAT_SCREEN_HEIGHT,
        };
    }

    private applyOperation(
        session: SimulatorSession,
        operation: SimulatorOperation,
    ): Record<string, unknown> {
        const { action, args } = operation;
        const pinName =
            typeof args.pin === "string" || typeof args.pin === "number" ? String(args.pin) : "";

        switch (action) {
            case "close_device":
                this.appendSerial(session, "system", "虚拟串口已断开");
                return { closed: true };
            case "reset_device": {
                this.resetSession(session);
                return { reset: true, sessionId: session.id };
            }
            case "get_device_info":
                return {
                    sessionId: session.id,
                    board: session.board,
                    capabilities: ["gpio", "adc", "pwm", "servo", "i2c", "serial"],
                    simulated: true,
                };
            case "flash_firmware":
                return { flashed: false, simulated: true, message: "仿真模式不需要烧录固件" };
            case "serial_write_text": {
                const text = this.stringArg(args, "text");
                this.appendSerial(session, "output", text);
                return { bytesWritten: Buffer.byteLength(text, "utf8") };
            }
            case "serial_write_bytes": {
                const bytes = Array.isArray(args.bytes) ? args.bytes : [];
                const text = bytes
                    .map((value) => Number(value).toString(16).padStart(2, "0"))
                    .join(" ");
                this.appendSerial(session, "output", `[${text}]`);
                return { bytesWritten: bytes.length };
            }
            case "serial_read_line": {
                const entry = [...session.serialLog]
                    .reverse()
                    .find((item) => item.direction === "input");
                return { text: entry?.text ?? "", available: !!entry };
            }
            case "serial_expect_text": {
                const text = this.stringArg(args, "text");
                return {
                    matched: session.serialLog.some((entry) => entry.text.includes(text)),
                    text,
                };
            }
            case "serial_request_response": {
                const command = this.stringArg(args, "command");
                this.appendSerial(session, "output", command);
                return { command, response: "OK", simulated: true };
            }
            case "gpio_set_mode": {
                const mode = this.stringArg(args, "mode") as VirtualPinMode;
                this.pin(session, pinName).mode = mode;
                return { pin: pinName, mode };
            }
            case "gpio_write": {
                const value = Boolean(args.value);
                const pin = this.pin(session, pinName);
                pin.mode = "output";
                pin.digitalValue = value;
                if (pinName === session.peripherals.led.pin) session.peripherals.led.on = value;
                if (pinName === session.peripherals.buzzer.pin)
                    session.peripherals.buzzer.active = value;
                return { pin: pinName, value };
            }
            case "gpio_read": {
                const value =
                    pinName === session.peripherals.button.pin
                        ? session.peripherals.button.pressed
                        : this.pin(session, pinName).digitalValue;
                return { pin: pinName, value };
            }
            case "analog_read": {
                const value =
                    pinName === session.peripherals.potentiometer.pin
                        ? session.peripherals.potentiometer.value
                        : this.pin(session, pinName).analogValue;
                const referenceVoltage = this.numberArg(args, "referenceVoltage", 3.3);
                return { pin: pinName, value, voltage: (value / 4095) * referenceVoltage };
            }
            case "pwm_write": {
                const pin = this.pin(session, pinName);
                pin.mode = "pwm";
                pin.pwmDutyCycle = this.clampNumber(this.numberArg(args, "dutyCycle", 0), 0, 1);
                pin.frequencyHz = this.clampNumber(
                    this.numberArg(args, "frequencyHz", 1000),
                    1,
                    20000,
                );
                if (pinName === session.peripherals.led.pin)
                    session.peripherals.led.on = pin.pwmDutyCycle > 0;
                if (pinName === session.peripherals.buzzer.pin) {
                    session.peripherals.buzzer.active = pin.pwmDutyCycle > 0;
                    session.peripherals.buzzer.frequencyHz = pin.frequencyHz;
                }
                return { pin: pinName, dutyCycle: pin.pwmDutyCycle, frequencyHz: pin.frequencyHz };
            }
            case "servo_write_angle": {
                const angle = this.clampNumber(this.numberArg(args, "angle", 90), 0, 180);
                session.peripherals.servo.pin = pinName;
                session.peripherals.servo.angle = angle;
                return { pin: pinName, angle };
            }
            case "i2c_scan":
                return {
                    addresses: session.i2cDevices.map((device) => device.address),
                    devices: session.i2cDevices,
                };
            case "i2c_write_register":
                return {
                    written: Array.isArray(args.data) ? args.data.length : 0,
                    simulated: true,
                };
            case "i2c_read_register": {
                const length = this.clampNumber(this.numberArg(args, "length", 1), 0, 256);
                return { data: Array.from({ length }, () => 0), simulated: true };
            }
            case "save_serial_log":
                return { saved: false, simulated: true, entries: session.serialLog.length };
            case "set_brightness": {
                const value = this.clampNumber(this.numberArg(args, "value", 0), 0, 100);
                session.cubecat.brightness = value;
                this.appendSerial(session, "system", `亮度 ${value}`);
                return { value };
            }
            case "set_volume": {
                const value = this.clampNumber(this.numberArg(args, "value", 0), 0, 100);
                session.cubecat.volume = value;
                this.appendSerial(session, "system", `音量 ${value}`);
                return { value };
            }
            case "vibrate": {
                const durationMs = this.clampNumber(this.numberArg(args, "durationMs", 300), 0, 5000);
                session.cubecat.lastVibrateMs = durationMs;
                this.appendSerial(session, "system", `震动 ${durationMs}ms`);
                return { durationMs };
            }
            case "notify": {
                const text = typeof args.text === "string" ? args.text : "";
                session.cubecat.lastNotify = text;
                this.appendSerial(session, "system", `通知 ${text}`);
                return { text };
            }
            case "alert_show": {
                const text = typeof args.text === "string" ? args.text : "";
                session.cubecat.lastAlert = text;
                this.appendSerial(session, "system", `播报 ${text}`);
                return { text };
            }
            case "camera_explain": {
                const question = typeof args.question === "string" ? args.question : "";
                const answer =
                    typeof args.answer === "string"
                        ? args.answer
                        : `仿真摄像头：没有真实画面。问题是：${question}`;
                session.cubecat.lastCameraQuestion = question;
                session.cubecat.lastCameraAnswer = answer;
                this.appendSerial(session, "system", `摄像头 ${question}`);
                return { question, answer };
            }
            case "audio_play":
            case "audio_play_bytes": {
                const source = typeof args.source === "string" ? args.source : "bytes";
                session.cubecat.lastAudio = source;
                this.appendSerial(session, "system", `音频 ${source}`);
                return { source, simulated: true };
            }
            case "audio_stop":
            case "audio_stop_all":
            case "http_request":
                return { simulated: true };
            default:
                throw HttpErrorFactory.badRequest(`不支持的虚拟设备操作：${action}`);
        }
    }

    private createSessionSnapshot(current: SimulatorSession): SimulatorSession {
        const now = new Date().toISOString();
        const reset: SimulatorSession = {
            ...current,
            revision: current.revision + 1,
            pins: {},
            peripherals: {
                led: { pin: "2", on: false },
                button: { pin: "0", pressed: false },
                potentiometer: { pin: "34", value: 2048, max: 4095 },
                buzzer: { pin: "25", active: false, frequencyHz: 0 },
                servo: { pin: "26", angle: 90 },
            },
            cubecat: createDefaultCubeCatState(),
            serialLog: [],
            updatedAt: now,
        };
        this.appendSerial(reset, "system", "CubeCat 仿真已复位");
        return reset;
    }

    private resetSession(session: SimulatorSession): SimulatorSession {
        // Preserve the reference: callers may execute several operations in one batch.
        Object.assign(session, this.createSessionSnapshot(session));
        this.sessions.set(session.id, session);
        return session;
    }

    private pin(session: SimulatorSession, name: string): VirtualPinState {
        if (!name) throw HttpErrorFactory.badRequest("请指定引脚");
        session.pins[name] ??= {
            mode: "input",
            digitalValue: false,
            analogValue: 0,
            pwmDutyCycle: 0,
            frequencyHz: 0,
        };
        return session.pins[name];
    }

    private appendSerial(
        session: SimulatorSession,
        direction: SimulatorSerialEntry["direction"],
        text: string,
    ): void {
        session.serialLog.push({
            id: this.nextSerialEntryId++,
            direction,
            text,
            createdAt: new Date().toISOString(),
        });
        if (session.serialLog.length > MAX_SERIAL_ENTRIES) {
            session.serialLog.splice(0, session.serialLog.length - MAX_SERIAL_ENTRIES);
        }
    }

    private touch(session: SimulatorSession): void {
        session.revision += 1;
        session.updatedAt = new Date().toISOString();
    }

    private stringArg(args: Record<string, unknown>, key: string): string {
        const value = args[key];
        if (typeof value !== "string" || !value) {
            throw HttpErrorFactory.badRequest(`参数 ${key} 不能为空`);
        }
        return value;
    }

    private numberArg(args: Record<string, unknown>, key: string, fallback: number): number {
        const value = args[key];
        return typeof value === "number" && Number.isFinite(value) ? value : fallback;
    }

    private clampNumber(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value));
    }

    private removeExpiredSessions(): void {
        const cutoff = Date.now() - SESSION_IDLE_TTL_MS;
        for (const [id, session] of this.sessions) {
            if (new Date(session.updatedAt).getTime() < cutoff) this.sessions.delete(id);
        }
    }
}
