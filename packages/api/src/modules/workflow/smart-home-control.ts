import {
    colorModeValue,
    expandXiaomiLightWrites,
    findWritableProperty,
    isRgbColorCapability,
    parsePackedRgb,
    whiteModeValue,
    type LightCapability,
    type XiaomiLightWrite,
} from "../smart-home/xiaomi-home.light";

export type SmartHomeProvider = "xiaomi" | "yeelight";

export type SmartHomeControlCommand = {
    on?: boolean;
    brightness?: number;
    color?: string | number;
    colorTemp?: number;
    mode?: "color" | "white";
    targetTemperature?: number;
    coverAction?: "open" | "close" | "stop";
    position?: number;
    speed?: number;
    oscillate?: boolean;
    properties?: Array<{
        siid?: number;
        piid?: number;
        name?: string;
        value: unknown;
    }>;
};

function capabilityName(capability: { name?: string }): string {
    return String(capability.name || "")
        .trim()
        .toLowerCase()
        .replace(/[-\s]/g, "_");
}

function findByName(capabilities: LightCapability[], names: string[]): LightCapability | undefined {
    const wanted = new Set(names.map((name) => name.toLowerCase().replace(/[-\s]/g, "_")));
    return capabilities.find(
        (capability) =>
            capability.kind === "property" &&
            wanted.has(capabilityName(capability)) &&
            (capability.access?.includes("write") ?? true),
    );
}

export function xiaomiWritesFromCommand(params: {
    did: string;
    capabilities: LightCapability[];
    state: Record<string, unknown>;
    command: SmartHomeControlCommand;
}): XiaomiLightWrite[] {
    const { did, capabilities, state, command } = params;
    const writes: XiaomiLightWrite[] = [];
    const seen = new Set<string>();

    const pushCapability = (capability: LightCapability | undefined, value: unknown) => {
        if (!capability || capability.piid === undefined) return;
        const expanded = expandXiaomiLightWrites({
            did,
            capabilities,
            state,
            capability,
            value,
        });
        for (const write of expanded) {
            const writeKey = `${write.siid}.${write.piid}`;
            if (seen.has(writeKey)) continue;
            seen.add(writeKey);
            writes.push(write);
        }
    };

    if (command.on !== undefined) {
        pushCapability(findWritableProperty(capabilities, ["on", "p", "power"]), command.on);
    }
    if (command.mode === "color") {
        const mode = findWritableProperty(capabilities, ["mode", "m"]);
        if (mode) pushCapability(mode, colorModeValue(mode));
    }
    if (command.mode === "white") {
        const mode = findWritableProperty(capabilities, ["mode", "m"]);
        if (mode) pushCapability(mode, whiteModeValue(mode));
    }
    if (command.color !== undefined) {
        const color = capabilities.find(
            (capability) =>
                capability.kind === "property" &&
                capability.piid !== undefined &&
                capability.access?.includes("write") &&
                isRgbColorCapability(capability),
        );
        const packed = parsePackedRgb(command.color);
        pushCapability(color, packed === null ? command.color : Math.max(1, packed));
    }
    if (command.colorTemp !== undefined) {
        pushCapability(
            findWritableProperty(capabilities, ["color_temperature", "ct"]),
            command.colorTemp,
        );
    }
    if (command.brightness !== undefined) {
        pushCapability(findWritableProperty(capabilities, ["brightness", "l"]), command.brightness);
    }
    if (command.targetTemperature !== undefined) {
        pushCapability(
            findWritableProperty(capabilities, ["target_temperature", "temperature"]),
            command.targetTemperature,
        );
    }
    if (command.speed !== undefined) {
        pushCapability(findWritableProperty(capabilities, ["fan_level", "speed", "level"]), command.speed);
    }
    if (command.oscillate !== undefined) {
        pushCapability(findWritableProperty(capabilities, ["oscillate", "swing"]), command.oscillate);
    }
    if (command.position !== undefined) {
        pushCapability(
            findWritableProperty(capabilities, ["current_position", "position", "motor_control"]),
            command.position,
        );
    }
    if (command.coverAction) {
        const actionValue =
            command.coverAction === "open" ? true : command.coverAction === "close" ? false : undefined;
        if (actionValue !== undefined) {
            pushCapability(findWritableProperty(capabilities, ["on", "open", "motor_control"]), actionValue);
        }
        if (command.coverAction === "stop") {
            pushCapability(findWritableProperty(capabilities, ["stop"]), true);
        }
    }

    for (const property of command.properties ?? []) {
        const capability =
            property.siid !== undefined && property.piid !== undefined
                ? capabilities.find(
                      (item) => item.siid === property.siid && item.piid === property.piid,
                  )
                : property.name
                  ? findByName(capabilities, [property.name])
                  : undefined;
        pushCapability(capability, property.value);
    }

    return writes;
}

export function yeelightPropertiesFromCommand(
    capabilities: Array<{ name: string }>,
    command: SmartHomeControlCommand,
): Record<string, unknown> {
    const names = new Set(capabilities.map((item) => item.name));
    const pick = (...candidates: string[]) => candidates.find((name) => names.has(name));
    const properties: Record<string, unknown> = {};

    const onName = pick("p", "on", "power");
    if (command.on !== undefined && onName) properties[onName] = command.on;

    const brightnessName = pick("l", "brightness");
    if (command.brightness !== undefined && brightnessName) {
        properties[brightnessName] = command.brightness;
    }

    const colorTempName = pick("ct", "color_temperature");
    if (command.colorTemp !== undefined && colorTempName) {
        properties[colorTempName] = command.colorTemp;
        const modeName = pick("m", "mode");
        if (modeName) properties[modeName] = properties[modeName] ?? "ct";
    }

    const colorName = pick("c", "color");
    if (command.color !== undefined && colorName) {
        const packed = parsePackedRgb(command.color);
        properties[colorName] = packed === null ? command.color : Math.max(1, packed);
        const modeName = pick("m", "mode");
        if (modeName) properties[modeName] = properties[modeName] ?? "rgb";
    }

    const modeName = pick("m", "mode");
    if (command.mode === "color" && modeName) properties[modeName] = "rgb";
    if (command.mode === "white" && modeName) properties[modeName] = "ct";

    for (const property of command.properties ?? []) {
        if (property.name && names.has(property.name)) {
            properties[property.name] = property.value;
        }
    }

    return properties;
}
