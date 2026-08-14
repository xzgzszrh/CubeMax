import { calculateLuaChunkCrc32 } from "./lua-device-protocol";

describe("Lua device protocol", () => {
    it("uses IEEE CRC-32 for source chunks", () => {
        expect(calculateLuaChunkCrc32(Buffer.from("123456789"))).toBe("cbf43926");
    });
});
