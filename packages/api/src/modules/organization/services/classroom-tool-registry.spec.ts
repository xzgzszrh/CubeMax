/**
 * 注册表本身住在 @buildingai/core（网关与已安装应用要共享同一个实例），
 * 但 core 包没有配 jest，所以测试放在 api 包里 —— 顺带也验证了 core 对外
 * 导出的接口是可用的。
 */
jest.mock("@buildingai/db/entities", () => require("./__fixtures__/db-entities.mock"));

import {
    type ClassroomToolContext,
    ClassroomToolRegistryService,
} from "@buildingai/core/modules/classroom";

const DEVICE_A = "11111111-1111-4111-8111-111111111111";
const DEVICE_B = "22222222-2222-4222-8222-222222222222";

function contextFor(agentBindingId: string, sessionId: string): ClassroomToolContext {
    return {
        agentBindingId,
        agentName: "方糖猫",
        organizationId: "org-1",
        ownerUserId: "teacher-1",
        assignedUserId: "student-1",
        sessionId,
    };
}

describe("ClassroomToolRegistryService", () => {
    let registry: ClassroomToolRegistryService;

    beforeEach(() => {
        registry = new ClassroomToolRegistryService();
    });

    it("only exposes a session's tools on the devices it targets", () => {
        registry.registerSession(
            "s1",
            [DEVICE_A],
            [{ name: "safe_unlock_attempt", handler: () => "ok" }],
        );

        expect(registry.listToolsFor(DEVICE_A).map((tool) => tool.name)).toEqual([
            "safe_unlock_attempt",
        ]);
        expect(registry.listToolsFor(DEVICE_B)).toEqual([]);
    });

    it("hands the calling device's identity to the handler", async () => {
        const seen: ClassroomToolContext[] = [];
        registry.registerSession(
            "s1",
            [DEVICE_A, DEVICE_B],
            [
                {
                    name: "safe_unlock_attempt",
                    handler: (args, context) => {
                        seen.push(context);
                        return { accepted: args.password === "1234" };
                    },
                },
            ],
        );

        const result = await registry.call(contextFor(DEVICE_B, "s1"), "safe_unlock_attempt", {
            password: "1234",
        });

        expect(result).toEqual({ accepted: true });
        expect(seen).toHaveLength(1);
        expect(seen[0].agentBindingId).toBe(DEVICE_B);
        expect(seen[0].assignedUserId).toBe("student-1");
    });

    it("refuses a device that the session does not target", async () => {
        registry.registerSession(
            "s1",
            [DEVICE_A],
            [{ name: "safe_unlock_attempt", handler: () => "ok" }],
        );

        await expect(
            registry.call(contextFor(DEVICE_B, "s1"), "safe_unlock_attempt", {}),
        ).rejects.toThrow("已失效");
    });

    it("stops exposing tools once the session is unregistered", () => {
        registry.registerSession(
            "s1",
            [DEVICE_A],
            [{ name: "safe_unlock_attempt", handler: () => "ok" }],
        );
        registry.unregisterSession("s1");

        expect(registry.listToolsFor(DEVICE_A)).toEqual([]);
    });

    it("re-registering a session replaces the previous device set", () => {
        registry.registerSession("s1", [DEVICE_A], [{ name: "probe", handler: () => "ok" }]);
        registry.registerSession("s1", [DEVICE_B], [{ name: "probe", handler: () => "ok" }]);

        expect(registry.listToolsFor(DEVICE_A)).toEqual([]);
        expect(registry.listToolsFor(DEVICE_B)).toHaveLength(1);
    });

    it("notifies listeners about every device whose tool list changed", () => {
        const changed: string[][] = [];
        registry.onChange((ids) => changed.push([...ids].sort()));

        registry.registerSession("s1", [DEVICE_A], [{ name: "probe", handler: () => "ok" }]);
        // 设备范围从 A 换成 B：A 和 B 都要收到 list_changed。
        registry.registerSession("s1", [DEVICE_B], [{ name: "probe", handler: () => "ok" }]);

        expect(changed[0]).toEqual([DEVICE_A]);
        expect(changed[1]).toEqual([DEVICE_A, DEVICE_B].sort());
    });

    it("rejects tool names the MCP protocol would not accept", () => {
        expect(() =>
            registry.registerSession(
                "s1",
                [DEVICE_A],
                [{ name: "bad name!", handler: () => "ok" }],
            ),
        ).toThrow("工具名不合法");
    });

    describe("内置课堂上报工具的接管", () => {
        it("默认不隐藏，应用可以直接复用内置工具做状态上报", () => {
            registry.registerSession("s1", [DEVICE_A], [{ name: "probe", handler: () => "ok" }]);

            expect(registry.isClassroomToolSuppressed(DEVICE_A)).toBe(false);
        });

        it("应用声明接管后，只影响它覆盖的设备", () => {
            registry.registerSession(
                "s1",
                [DEVICE_A],
                [{ name: "safe_unlock_attempt", handler: () => "ok" }],
                { suppressClassroomTool: true },
            );

            expect(registry.isClassroomToolSuppressed(DEVICE_A)).toBe(true);
            expect(registry.isClassroomToolSuppressed(DEVICE_B)).toBe(false);
        });

        it("多个会话覆盖同一设备时取或", () => {
            registry.registerSession("keep", [DEVICE_A], [{ name: "a", handler: () => "ok" }]);
            registry.registerSession("take", [DEVICE_A], [{ name: "b", handler: () => "ok" }], {
                suppressClassroomTool: true,
            });

            expect(registry.isClassroomToolSuppressed(DEVICE_A)).toBe(true);
        });

        it("会话结束后内置工具恢复", () => {
            registry.registerSession("s1", [DEVICE_A], [{ name: "a", handler: () => "ok" }], {
                suppressClassroomTool: true,
            });
            registry.unregisterSession("s1");

            expect(registry.isClassroomToolSuppressed(DEVICE_A)).toBe(false);
        });
    });
});
