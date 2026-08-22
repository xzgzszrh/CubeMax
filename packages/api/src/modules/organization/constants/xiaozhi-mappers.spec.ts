import {
    mapUpstreamChat,
    mapUpstreamChatMessage,
    mapUpstreamDevice,
    summarizeDevices,
} from "./xiaozhi-mappers";

const AGENT_ID = "0b1d4f2e-1111-4b0e-9c2f-8f26c3a10001";

describe("mapUpstreamDevice", () => {
    it("reads the 0/1 auto-update flag as a boolean", () => {
        expect(mapUpstreamDevice({ id: 1, auto_update: 1 }, AGENT_ID).autoUpdate).toBe(true);
        expect(mapUpstreamDevice({ id: 1, auto_update: 0 }, AGENT_ID).autoUpdate).toBe(false);
        expect(mapUpstreamDevice({ id: 1, auto_update: "1" }, AGENT_ID).autoUpdate).toBe(true);
        expect(mapUpstreamDevice({ id: 1, auto_update: null }, AGENT_ID).autoUpdate).toBe(false);
    });

    it("falls back from alias to the upstream device name", () => {
        expect(mapUpstreamDevice({ id: 1, device_name: "方糖猫" }, AGENT_ID).alias).toBe("方糖猫");
        expect(
            mapUpstreamDevice({ id: 1, alias: "三班讲台", device_name: "方糖猫" }, AGENT_ID).alias,
        ).toBe("三班讲台");
        expect(mapUpstreamDevice({ id: 1 }, AGENT_ID).alias).toBe("");
    });

    it("keeps the local agent binding id rather than the upstream agent id", () => {
        const device = mapUpstreamDevice({ id: 7, agent_id: 4210 }, AGENT_ID);
        expect(device.agentId).toBe(AGENT_ID);
        expect(device.id).toBe(7);
    });

    it("lifts the claw4 client id used by the Lua script channel", () => {
        expect(
            mapUpstreamDevice({ id: 1, client_id: "3f2c1b0a-1111-4c2d-9e8f-abcdef123456" }, AGENT_ID)
                .clientId,
        ).toBe("3f2c1b0a-1111-4c2d-9e8f-abcdef123456");
        expect(mapUpstreamDevice({ id: 1 }, AGENT_ID).clientId).toBe("");
    });
});

describe("summarizeDevices", () => {
    it("counts online devices and picks the newest connection time", () => {
        const devices = [
            mapUpstreamDevice(
                { id: 1, online: true, last_connected_at: "2026-07-01T10:00:00.000Z" },
                AGENT_ID,
            ),
            mapUpstreamDevice(
                { id: 2, online: false, last_connected_at: "2026-07-20T08:30:00.000Z" },
                AGENT_ID,
            ),
        ];

        expect(summarizeDevices(devices)).toEqual({
            deviceCount: 2,
            onlineDeviceCount: 1,
            lastConnectedAt: new Date("2026-07-20T08:30:00.000Z"),
        });
    });

    it("reports no connection time when upstream never saw a device online", () => {
        const devices = [mapUpstreamDevice({ id: 1, last_connected_at: null }, AGENT_ID)];
        expect(summarizeDevices(devices).lastConnectedAt).toBeNull();
        expect(summarizeDevices([]).deviceCount).toBe(0);
    });
});

describe("mapUpstreamChat", () => {
    it("names untitled sessions and zero-fills missing counters", () => {
        const chat = mapUpstreamChat({ id: 9 }, AGENT_ID, "英语助教");
        expect(chat).toMatchObject({
            id: 9,
            agentId: AGENT_ID,
            agentName: "英语助教",
            title: "未命名对话",
            summary: "",
            messageCount: 0,
            tokenCount: 0,
        });
    });

    it("lifts the title and summary out of the nested chat summary", () => {
        const chat = mapUpstreamChat(
            { id: 9, chat_summary: { title: "课堂问答", summary: "复习了时态" } },
            AGENT_ID,
            "英语助教",
        );
        expect(chat.title).toBe("课堂问答");
        expect(chat.summary).toBe("复习了时态");
    });
});

describe("mapUpstreamChatMessage", () => {
    it("defaults an unknown role to assistant and backfills the chat id", () => {
        const message = mapUpstreamChatMessage({ id: 3, content: "你好" }, 88);
        expect(message.role).toBe("assistant");
        expect(message.chatId).toBe(88);
        expect(message.content).toBe("你好");
    });

    it("keeps the upstream chat id when present", () => {
        expect(mapUpstreamChatMessage({ id: 3, chat_id: 12, role: "user" }, 88)).toMatchObject({
            chatId: 12,
            role: "user",
        });
    });
});
