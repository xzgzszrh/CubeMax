import { inferYeelightLight, parseScanLoginResponse } from "./yeelight-pro.cloud";
import { yeelightQrcodeContent, yeelightScanDeviceId } from "./yeelight-pro.constants";

describe("Yeelight Pro cloud contract", () => {
    it("builds APP-supported QR content", () => {
        expect(yeelightQrcodeContent("ba-device", "qr-1")).toBe("cli&ba-device&qr-1");
    });

    it("derives a stable scan device id for a BuildingAI user", () => {
        const first = yeelightScanDeviceId("user-a");
        const second = yeelightScanDeviceId("user-a");
        expect(first).toBe(second);
        expect(first.startsWith("ba-")).toBe(true);
        expect(first).not.toBe(yeelightScanDeviceId("user-b"));
    });

    it("parses a scan-login LOGIN payload without exposing raw token shape mismatches", () => {
        const parsed = parseScanLoginResponse({
            code: 0,
            data: {
                qrCodeId: "qr-login",
                device: "ba-device",
                status: "LOGIN",
                expireIn: 300000,
                token: {
                    accessToken: "access-token-".repeat(3),
                    refreshToken: "refresh-token-".repeat(3),
                    tokenType: "Bearer",
                    expiresIn: 3600,
                    username: "yeelight-user",
                    clientId: "client-id",
                    clientSecret: "client-secret",
                },
            },
        });
        expect(parsed.status).toBe("LOGIN");
        expect(parsed.qrCodeId).toBe("qr-login");
        expect(parsed.token?.username).toBe("yeelight-user");
        expect(parsed.token?.expiresIn).toBe(3600);
    });

    it("projects color-light capabilities from Yeelight cloud properties", () => {
        const light = inferYeelightLight({
            id: "12",
            name: "客厅彩光灯",
            productId: 5,
            model: "color-bulb",
            icon: null,
            category: "light",
            online: true,
            roomId: "1",
            roomName: "客厅",
            houseId: "9",
            houseName: "家里",
            properties: { p: true, l: 80, ct: 4000, c: 16711680, m: "rgb" },
            metadata: {},
        });
        expect(light.category).toBe("light");
        expect(light.capabilities.map((item) => item.name)).toEqual(
            expect.arrayContaining(["p", "l", "ct", "c", "m"]),
        );
        expect(light.capabilities.find((item) => item.name === "c")?.format).toBe("rgb");
    });
});
