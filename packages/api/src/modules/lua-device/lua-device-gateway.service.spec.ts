import { createHmac } from "crypto";

import { buildLuaDeviceAuthCanonical, calculateLuaChunkCrc32 } from "./lua-device-protocol";

describe("Lua device protocol", () => {
    it("matches the protocol HMAC test vector", () => {
        const canonical = buildLuaDeviceAuthCanonical({
            nonceB64: "mP7sZx4PYpYNpQbAlyQ2mMdM9yAFNHN9mq4aG9o7PSw=",
            deviceId: "a2a494dc-4e76-4b8f-8c7f-439d42087edb",
            keyId: "v1",
            bootId: "9b3e1fc4-b605-4edf-9ba3-677e4f77ce16",
            firmwareVersion: "1.0.0",
        });
        const secret = Buffer.from(
            "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
            "hex",
        );

        expect(createHmac("sha256", secret).update(canonical).digest("base64")).toBe(
            "rM1C/a8JMdHZQUm5pq19ekRVhIBM5vLepj2tphjiEB8=",
        );
    });

    it("uses IEEE CRC-32 for source chunks", () => {
        expect(calculateLuaChunkCrc32(Buffer.from("123456789"))).toBe("cbf43926");
    });
});
