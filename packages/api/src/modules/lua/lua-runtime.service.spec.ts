import { LuaRuntimeService } from "./lua-runtime.service";

jest.mock("@buildingai/errors", () => ({
    HttpErrorFactory: {
        badRequest: (message: string) => new Error(message),
    },
}));

describe("LuaRuntimeService", () => {
    let service: LuaRuntimeService;

    beforeEach(() => {
        service = new LuaRuntimeService();
    });

    it("executes a module with JSON-compatible inputs and outputs", async () => {
        const result = await service.execute(
            `function main(params)
                return { sum = params.a + params.b, nested = { ok = true } }
            end`,
            { a: 2, b: 3 },
        );

        expect(result.output).toEqual({ sum: 5, nested: { ok: true } });
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("rejects scripts without a main function", async () => {
        await expect(service.validate("local value = 1")).rejects.toThrow("main(params)");
    });

    it("terminates scripts that exceed the execution deadline", async () => {
        await expect(
            service.execute("function main(params) while true do end end"),
        ).rejects.toThrow("执行超时");
    }, 10_000);

    it("does not expose operating system libraries", async () => {
        const result = await service.execute(
            "function main(params) return { osAvailable = os ~= nil, ioAvailable = io ~= nil } end",
        );
        expect(result.output).toEqual({ osAvailable: false, ioAvailable: false });
    });
});
