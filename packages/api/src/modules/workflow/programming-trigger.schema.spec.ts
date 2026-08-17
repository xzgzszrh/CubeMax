import {
    extractProgrammingInputSchema,
    validateProgrammingInputs,
} from "./programming-trigger.schema";

describe("programming trigger input schema", () => {
    it("extracts the start node outputs and normalizes map schemas", () => {
        const schema = extractProgrammingInputSchema({
            nodes: [
                {
                    id: "start",
                    type: "start",
                    data: {
                        outputs: {
                            type: "map",
                            required: ["room"],
                            properties: {
                                room: { type: "string" },
                                count: { type: "integer", default: 1 },
                                options: {
                                    type: "object",
                                    properties: {
                                        enabled: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                },
            ],
        });

        expect(schema).toEqual({
            type: "object",
            required: ["room"],
            properties: {
                room: { type: "string" },
                count: { type: "integer", default: 1 },
                options: {
                    type: "object",
                    properties: {
                        enabled: { type: "boolean" },
                    },
                },
            },
        });
    });

    it("returns an empty object schema when the workflow has no usable start node", () => {
        expect(extractProgrammingInputSchema({ nodes: [{ type: "message" }] })).toEqual({
            type: "object",
            properties: {},
        });
    });

    it("applies defaults without mutating the request body", () => {
        const inputs = { room: "living-room", options: { enabled: true } };
        const result = validateProgrammingInputs(
            {
                type: "object",
                required: ["room"],
                properties: {
                    room: { type: "string" },
                    count: { type: "integer", default: 1 },
                    options: {
                        type: "object",
                        properties: { enabled: { type: "boolean" } },
                    },
                },
            },
            inputs,
        );

        expect(result).toEqual({
            valid: true,
            inputs: { room: "living-room", count: 1, options: { enabled: true } },
        });
        expect(inputs).toEqual({ room: "living-room", options: { enabled: true } });
    });

    it.each([
        ["missing required field", {}, "缺少必填项「room」"],
        ["wrong primitive type", { room: 12 }, "/room应为string"],
        ["invalid enum", { room: "attic" }, "/room不是可选值"],
        ["invalid object", { room: "living-room", settings: "yes" }, "/settings应为object"],
        ["invalid array", { room: "living-room", values: "yes" }, "/values应为array"],
    ])("rejects %s", (_name, inputs, message) => {
        const schema = {
            type: "object",
            required: ["room"],
            additionalProperties: false,
            properties: {
                room: { type: "string", enum: ["living-room", "bedroom"] },
                settings: { type: "object" },
                values: { type: "array", items: { type: "number" } },
            },
        };

        const result = validateProgrammingInputs(schema, inputs as Record<string, unknown>);

        expect(result).toEqual({ valid: false, message: expect.stringContaining(message) });
    });

    it("rejects additional properties", () => {
        const result = validateProgrammingInputs(
            {
                type: "object",
                additionalProperties: false,
                properties: { room: { type: "string" } },
            },
            { room: "living-room", unexpected: true },
        );

        expect(result).toEqual({
            valid: false,
            message: expect.stringContaining("包含未定义字段「unexpected」"),
        });
    });
});
