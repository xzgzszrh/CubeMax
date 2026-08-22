import {
    expandXiaomiLightWrites,
    parsePackedRgb,
    rewriteInvalidBoolWrites,
} from "./xiaomi-home.light";

const colorBulb = [
    {
        kind: "property" as const,
        name: "on",
        siid: 2,
        piid: 1,
        format: "bool",
        access: ["read", "write"],
    },
    {
        kind: "property" as const,
        name: "brightness",
        siid: 2,
        piid: 2,
        format: "uint8",
        access: ["read", "write"],
        valueRange: { min: 1, max: 100, step: 1 },
    },
    {
        kind: "property" as const,
        name: "color-temperature",
        siid: 2,
        piid: 3,
        format: "uint32",
        access: ["read", "write"],
        unit: "kelvin",
        valueRange: { min: 1700, max: 6500, step: 1 },
    },
    {
        kind: "property" as const,
        name: "color",
        siid: 2,
        piid: 4,
        format: "uint32",
        access: ["read", "write"],
        unit: "rgb",
        valueRange: { min: 1, max: 16777215, step: 1 },
    },
    {
        kind: "property" as const,
        name: "mode",
        siid: 2,
        piid: 5,
        format: "uint8",
        access: ["read", "write"],
        valueList: [
            { value: 1, description: "Color" },
            { value: 2, description: "Day" },
        ],
    },
];

describe("Xiaomi color light writes", () => {
    it("parses hex colors used by the light UI", () => {
        expect(parsePackedRgb("#ff0000")).toBe(0xff0000);
        expect(parsePackedRgb([0, 255, 0])).toBe(0x00ff00);
    });

    it("turns the bulb on and switches to color mode before setting RGB", () => {
        const writes = expandXiaomiLightWrites({
            did: "yeelink-w3",
            capabilities: colorBulb,
            state: { "2.1": false, "2.5": 2 },
            capability: colorBulb[3],
            value: 0xff0000,
        });
        expect(writes).toEqual([
            { did: "yeelink-w3", siid: 2, piid: 1, value: true },
            { did: "yeelink-w3", siid: 2, piid: 5, value: 1 },
            { did: "yeelink-w3", siid: 2, piid: 4, value: 0xff0000 },
        ]);
    });

    it("switches to daylight mode before setting color temperature", () => {
        const writes = expandXiaomiLightWrites({
            did: "yeelink-w3",
            capabilities: colorBulb,
            state: { "2.1": true, "2.5": 1 },
            capability: colorBulb[2],
            value: 4000,
        });
        expect(writes).toEqual([
            { did: "yeelink-w3", siid: 2, piid: 5, value: 2 },
            { did: "yeelink-w3", siid: 2, piid: 3, value: 4000 },
        ]);
    });

    it("retries rejected boolean writes as 0/1", () => {
        expect(
            rewriteInvalidBoolWrites(
                [{ did: "yeelink-w3", siid: 2, piid: 1, value: true }],
                colorBulb,
            ),
        ).toEqual([{ did: "yeelink-w3", siid: 2, piid: 1, value: 1 }]);
    });
});
