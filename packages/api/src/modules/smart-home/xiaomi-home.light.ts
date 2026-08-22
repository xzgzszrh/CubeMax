import type { XiaomiHomeCapability } from "@buildingai/db/entities";

export const XIAOMI_MIOT_INVALID_VALUE = -704042011;

export type XiaomiLightWrite = {
    did: string;
    siid: number;
    piid: number;
    value: unknown;
};

export type LightCapability = Pick<
    XiaomiHomeCapability,
    "kind" | "name" | "siid" | "piid" | "access" | "format" | "unit" | "valueList" | "valueRange"
>;

function propertyName(capability: { name?: string }): string {
    return String(capability.name || "")
        .trim()
        .toLowerCase()
        .replace(/[-\s]/g, "_");
}

export function isRgbColorCapability(capability: { name?: string; unit?: string | null }): boolean {
    const unit = String(capability.unit || "").toLowerCase();
    const name = propertyName(capability);
    return unit === "rgb" || name === "color" || name === "colour" || name === "c";
}

export function parsePackedRgb(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === "string") {
        const hex = value.trim();
        if (/^#?[0-9a-fA-F]{6}$/.test(hex)) return Number.parseInt(hex.replace("#", ""), 16);
        const numeric = Number(hex);
        if (Number.isFinite(numeric)) return Math.trunc(numeric);
    }
    if (Array.isArray(value) && value.length === 3) {
        const [red, green, blue] = value.map((item) => Number(item));
        if ([red, green, blue].every((item) => Number.isFinite(item))) {
            return ((red & 255) << 16) | ((green & 255) << 8) | (blue & 255);
        }
    }
    return null;
}

export function findWritableProperty(
    capabilities: LightCapability[],
    names: string[],
): LightCapability | undefined {
    const wanted = new Set(names.map((name) => name.toLowerCase().replace(/[-\s]/g, "_")));
    return capabilities.find(
        (capability) =>
            capability.kind === "property" &&
            capability.piid !== undefined &&
            capability.access?.includes("write") &&
            wanted.has(propertyName(capability)),
    );
}

export function colorModeValue(mode: LightCapability): unknown {
    const match = mode.valueList?.find((item) =>
        /color|rgb|彩光/i.test(String(item.description || item.value)),
    );
    return match?.value ?? 1;
}

export function whiteModeValue(mode: LightCapability): unknown {
    const match = mode.valueList?.find((item) =>
        /day|ct|white|temp|日光|白光|色温/i.test(String(item.description || item.value)),
    );
    return match?.value ?? 2;
}

export function expandXiaomiLightWrites(params: {
    did: string;
    capabilities: LightCapability[];
    state: Record<string, unknown>;
    capability: LightCapability;
    value: unknown;
}): XiaomiLightWrite[] {
    const { did, capabilities, state, capability, value } = params;
    if (capability.piid === undefined) return [];

    const writes: XiaomiLightWrite[] = [];
    const name = propertyName(capability);
    const on = findWritableProperty(capabilities, ["on", "p", "power"]);
    const mode = findWritableProperty(capabilities, ["mode", "m"]);
    const currentlyOn = on?.piid !== undefined ? state[`${on.siid}.${on.piid}`] : undefined;
    const needsPower =
        on &&
        currentlyOn !== true &&
        currentlyOn !== 1 &&
        ["brightness", "l", "color", "colour", "c", "color_temperature", "ct"].includes(name);

    if (needsPower && on.piid !== undefined) {
        writes.push({ did, siid: on.siid, piid: on.piid, value: true });
    }

    if (mode?.piid !== undefined && (name === "color" || name === "colour" || name === "c")) {
        writes.push({ did, siid: mode.siid, piid: mode.piid, value: colorModeValue(mode) });
    }
    if (mode?.piid !== undefined && (name === "color_temperature" || name === "ct")) {
        writes.push({ did, siid: mode.siid, piid: mode.piid, value: whiteModeValue(mode) });
    }

    writes.push({ did, siid: capability.siid, piid: capability.piid, value });
    return writes;
}

export function rewriteInvalidBoolWrites(
    writes: XiaomiLightWrite[],
    capabilities: LightCapability[],
): XiaomiLightWrite[] {
    return writes.map((write) => {
        const capability = capabilities.find(
            (item) => item.siid === write.siid && item.piid === write.piid,
        );
        if (capability?.format !== "bool") return write;
        if (write.value === true) return { ...write, value: 1 };
        if (write.value === false) return { ...write, value: 0 };
        return write;
    });
}
