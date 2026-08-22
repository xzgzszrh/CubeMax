import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    ProgrammingProjectTool,
    programmingProjectToolKey,
    type ProgrammingProjectPublishedSnapshot,
} from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable } from "@nestjs/common";

import { XiaomiHomeService } from "../smart-home/xiaomi-home.service";
import {
    findWritableProperty,
    isRgbColorCapability,
    type LightCapability,
} from "../smart-home/xiaomi-home.light";
import { YeelightProService } from "../smart-home/yeelight-pro.service";
import {
    yeelightPropertiesFromCommand,
    type SmartHomeControlCommand,
    type SmartHomeProvider,
} from "./smart-home-control";

export type WorkflowSmartHomeExecutorInput = {
    userId?: string;
    runtimeContext?: {
        projectId?: string;
        publishedSnapshot?: unknown;
    };
    node: {
        id: string;
        type: string;
        data?: {
            provider?: SmartHomeProvider;
            deviceId?: string;
            command?: SmartHomeControlCommand;
        };
    };
    inputs: Record<string, unknown>;
};

@Injectable()
export class WorkflowSmartHomeExecutorService {
    constructor(
        @InjectRepository(ProgrammingProjectTool)
        private readonly projectToolRepository: Repository<ProgrammingProjectTool>,
        private readonly xiaomiHomeService: XiaomiHomeService,
        private readonly yeelightProService: YeelightProService,
    ) {}

    async execute(input: WorkflowSmartHomeExecutorInput): Promise<Record<string, unknown>> {
        if (!input.userId) throw new Error("智能家居节点需要登录后执行");
        const provider = input.node.data?.provider;
        const deviceId = input.node.data?.deviceId;
        if (provider !== "xiaomi" && provider !== "yeelight") {
            throw new Error("智能家居节点尚未选择设备平台");
        }
        if (!deviceId) throw new Error("智能家居节点尚未选择设备");

        await this.assertProjectToolAccess(input, provider, deviceId);

        const command = mergeCommand(input.node.data?.command, input.inputs);
        if (provider === "yeelight") {
            const device = await this.yeelightProService.getDevice(input.userId, deviceId);
            const properties = yeelightPropertiesFromCommand(device.capabilities, command);
            const updated = Object.keys(properties).length
                ? await this.yeelightProService.setProperties(input.userId, deviceId, properties)
                : device;
            return {
                success: true,
                deviceId: updated.id,
                name: updated.name,
                online: updated.online,
                state: updated.state,
            };
        }

        const device = await this.xiaomiHomeService.getDevice(input.userId, deviceId);
        await this.applyXiaomiCommand(
            input.userId,
            device.id,
            device.capabilities,
            command,
        );
        const updated = await this.xiaomiHomeService.getDevice(input.userId, deviceId);
        return {
            success: true,
            deviceId: updated.id,
            name: updated.name,
            online: updated.online,
            state: updated.state,
        };
    }

    private async applyXiaomiCommand(
        userId: string,
        deviceId: string,
        capabilities: LightCapability[],
        command: SmartHomeControlCommand,
    ): Promise<void> {
        const set = async (capability: { siid?: number; piid?: number } | undefined, value: unknown) => {
            if (!capability || capability.piid === undefined) return;
            await this.xiaomiHomeService.setProperty(userId, deviceId, {
                siid: capability.siid ?? 0,
                piid: capability.piid,
                value,
            });
        };

        if (command.on !== undefined) {
            await set(findWritableProperty(capabilities, ["on", "p", "power"]), command.on);
        }
        if (command.mode === "color") {
            const mode = findWritableProperty(capabilities, ["mode", "m"]);
            const value = mode?.valueList?.find((item) =>
                /color|rgb|彩光/i.test(String(item.description || item.value)),
            )?.value;
            await set(mode, value ?? 1);
        }
        if (command.mode === "white") {
            const mode = findWritableProperty(capabilities, ["mode", "m"]);
            const value = mode?.valueList?.find((item) =>
                /day|ct|white|temp|日光|白光|色温/i.test(String(item.description || item.value)),
            )?.value;
            await set(mode, value ?? 2);
        }
        if (command.color !== undefined) {
            const color = capabilities.find(
                (capability) =>
                    capability.kind === "property" &&
                    capability.piid !== undefined &&
                    capability.access?.includes("write") &&
                    isRgbColorCapability(capability),
            );
            await set(color, command.color);
        }
        if (command.colorTemp !== undefined) {
            await set(
                findWritableProperty(capabilities, ["color_temperature", "ct"]),
                command.colorTemp,
            );
        }
        if (command.brightness !== undefined) {
            await set(findWritableProperty(capabilities, ["brightness", "l"]), command.brightness);
        }
        if (command.targetTemperature !== undefined) {
            await set(
                findWritableProperty(capabilities, ["target_temperature", "temperature"]),
                command.targetTemperature,
            );
        }
        if (command.speed !== undefined) {
            await set(
                findWritableProperty(capabilities, ["fan_level", "speed", "level"]),
                command.speed,
            );
        }
        if (command.oscillate !== undefined) {
            await set(findWritableProperty(capabilities, ["oscillate", "swing"]), command.oscillate);
        }
        if (command.position !== undefined) {
            await set(
                findWritableProperty(capabilities, ["current_position", "position"]),
                command.position,
            );
        }
        if (command.coverAction === "open") {
            await set(findWritableProperty(capabilities, ["on", "open"]), true);
        }
        if (command.coverAction === "close") {
            await set(findWritableProperty(capabilities, ["on", "open"]), false);
        }
        if (command.coverAction === "stop") {
            await set(findWritableProperty(capabilities, ["stop"]), true);
        }
        for (const property of command.properties ?? []) {
            if (property.siid !== undefined && property.piid !== undefined) {
                await this.xiaomiHomeService.setProperty(userId, deviceId, {
                    siid: property.siid,
                    piid: property.piid,
                    value: property.value,
                });
            }
        }
    }

    private async assertProjectToolAccess(
        input: WorkflowSmartHomeExecutorInput,
        provider: SmartHomeProvider,
        deviceId: string,
    ): Promise<void> {
        const snapshot = input.runtimeContext?.publishedSnapshot;
        if (isPublishedSnapshot(snapshot)) {
            const allowed = snapshot.tools.some(
                (tool) =>
                    programmingProjectToolKey(tool) ===
                    programmingProjectToolKey({ kind: provider, deviceId }),
            );
            if (!allowed) throw new Error("该物联网设备未包含在已发布工程中");
            return;
        }
        if (!input.runtimeContext?.projectId) return;
        const enabled = await this.projectToolRepository.findOne({
            where: {
                projectId: input.runtimeContext.projectId,
                toolKey: programmingProjectToolKey({ kind: provider, deviceId }),
            },
        });
        if (!enabled) throw new Error("该物联网设备未加入当前工程");
    }
}

function isPublishedSnapshot(value: unknown): value is ProgrammingProjectPublishedSnapshot {
    return (
        !!value &&
        typeof value === "object" &&
        (value as ProgrammingProjectPublishedSnapshot).version === 1 &&
        Array.isArray((value as ProgrammingProjectPublishedSnapshot).tools)
    );
}

function mergeCommand(
    command: SmartHomeControlCommand | undefined,
    inputs: Record<string, unknown>,
): SmartHomeControlCommand {
    const next: SmartHomeControlCommand = { ...(command ?? {}) };
    if (typeof inputs.on === "boolean") next.on = inputs.on;
    if (typeof inputs.brightness === "number") next.brightness = inputs.brightness;
    if (typeof inputs.colorTemp === "number") next.colorTemp = inputs.colorTemp;
    if (typeof inputs.color === "string" || typeof inputs.color === "number") {
        next.color = inputs.color;
    }
    if (inputs.mode === "color" || inputs.mode === "white") next.mode = inputs.mode;
    if (typeof inputs.targetTemperature === "number") {
        next.targetTemperature = inputs.targetTemperature;
    }
    if (typeof inputs.speed === "number") next.speed = inputs.speed;
    if (typeof inputs.oscillate === "boolean") next.oscillate = inputs.oscillate;
    if (typeof inputs.position === "number") next.position = inputs.position;
    if (inputs.coverAction === "open" || inputs.coverAction === "close" || inputs.coverAction === "stop") {
        next.coverAction = inputs.coverAction;
    }
    return next;
}
