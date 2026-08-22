import { XiaomiHomeCloudClient } from "./xiaomi-home.cloud";
import { getXiaomiHomeCategory } from "./xiaomi-home.constants";

describe("Xiaomi Home cloud compatibility", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("uses Xiaomi's legacy Bearer header format", async () => {
        const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(
                JSON.stringify({
                    code: 0,
                    result: [{ did: "device-1", siid: 2, piid: 1, value: true, code: 0 }],
                }),
                { status: 200 },
            ),
        );
        const client = new XiaomiHomeCloudClient("cn", "test-token");

        await client.getProperties([{ did: "device-1", siid: 2, piid: 1 }]);

        expect(fetchMock).toHaveBeenCalledWith(
            "https://ha.api.io.mi.com/app/v2/miotspec/prop/get",
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearertest-token" }),
            }),
        );
    });

    it("classifies generic devices from their MIoT services", () => {
        expect(
            getXiaomiHomeCategory(
                "urn:miot-spec-v2:device:unknown:0000A000:vendor-model:1",
                undefined,
                ["environment", "air-purifier"],
            ),
        ).toBe("fan");
        expect(
            getXiaomiHomeCategory(
                "urn:miot-spec-v2:device:unknown:0000A000:vendor-model:1",
                undefined,
                ["battery", "curtain"],
            ),
        ).toBe("cover");
    });

    it("keeps the relay redirect URI intact in the authorization URL", () => {
        const redirectUri = "http://homeassistant.local:8123/api/webhook/buildingai-test-session";
        const authorizationUrl = new URL(
            XiaomiHomeCloudClient.buildAuthorizationUrl({
                redirectUri,
                deviceId: "ha.test-device",
                state: "test-state",
            }),
        );

        expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(redirectUri);
        expect(authorizationUrl.searchParams.get("state")).toBe("test-state");
    });
});
