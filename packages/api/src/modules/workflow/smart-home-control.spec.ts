import { yeelightPropertiesFromCommand, xiaomiWritesFromCommand } from "./smart-home-control";

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

describe("smart-home-control", () => {
    it("maps yeelight light command onto p/l/c/m", () => {
        expect(
            yeelightPropertiesFromCommand(
                [{ name: "p" }, { name: "l" }, { name: "c" }, { name: "ct" }, { name: "m" }],
                { on: true, brightness: 80, color: "#ff8800" },
            ),
        ).toEqual({
            p: true,
            l: 80,
            c: 0xff8800,
            m: "rgb",
        });
    });

    it("maps xiaomi color writes and turns the lamp on first", () => {
        const writes = xiaomiWritesFromCommand({
            did: "lamp-1",
            capabilities: colorBulb,
            state: { "2.1": false },
            command: { color: "#00ff00", brightness: 40 },
        });
        expect(writes.map((write) => [write.siid, write.piid, write.value])).toEqual([
            [2, 1, true],
            [2, 5, 1],
            [2, 4, 0x00ff00],
            [2, 2, 40],
        ]);
    });
});
