/**
 * ClassroomKit 住在 @buildingai/core（要和 MCP 网关共享工具注册表），但 core 包
 * 没有配 jest，所以测试放在 api 包里 —— 顺带验证 core 对外导出的接口可用。
 *
 * 这里用假仓储而不是连库：要验证的是接管/归还的**顺序与语义**（先快照后下发、
 * 逐设备恢复、超时兜底），这些和数据库方言无关。
 */
jest.mock("@buildingai/db/entities", () => require("./__fixtures__/db-entities.mock"));

import {
    type ClassroomCaller,
    ClassroomKitPermission,
    ClassroomKitService,
    ClassroomToolRegistryService,
    ClassroomWorkspacePort,
} from "@buildingai/core/modules/classroom";

import { OrganizationPermission } from "../constants/organization-permissions";

const ORG = "org-1";
const DEVICE_A = "11111111-1111-4111-8111-111111111111";
const DEVICE_B = "22222222-2222-4222-8222-222222222222";
const FOREIGN = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;

/** 只解释我们实际用到的 TypeORM 查询算子。 */
function matchValue(actual: unknown, expected: unknown): boolean {
    if (expected && typeof expected === "object" && "type" in expected && "value" in expected) {
        const op = expected as { type: string; value: unknown };
        if (op.type === "in") return (op.value as unknown[]).includes(actual);
        if (op.type === "isNull") return actual === null || actual === undefined;
        if (op.type === "lessThanOrEqual") {
            return actual != null && (actual as number) <= (op.value as number);
        }
        return true;
    }
    return actual === expected;
}

function matches(row: Row, where: Row = {}) {
    return Object.entries(where).every(([key, value]) => matchValue(row[key], value));
}

class FakeRepo<T extends Row> {
    constructor(public rows: T[] = []) {}
    private seq = 0;

    create(data: Partial<T>) {
        this.seq += 1;
        return { id: `row-${this.seq}`, createdAt: new Date(), ...data } as unknown as T;
    }
    async save(row: T) {
        const index = this.rows.findIndex((item) => item.id === row.id);
        if (index >= 0) this.rows[index] = row;
        else this.rows.push(row);
        return row;
    }
    async find(options: { where?: Row } = {}) {
        return this.rows.filter((row) => matches(row, options.where));
    }
    async findOne(options: { where?: Row } = {}) {
        return this.rows.find((row) => matches(row, options.where)) ?? null;
    }
    async count(options: { where?: Row } = {}) {
        return (await this.find(options)).length;
    }
}

/** 记录每台设备当前的上游配置，下发即改写，读取即返回。 */
class FakePort extends ClassroomWorkspacePort {
    configs = new Map<string, Record<string, unknown>>();
    permissions: string[] = ["asset:read", "asset:manage", "member:read"];
    writes: Array<{ agentBindingId: string; config: Record<string, unknown> }> = [];
    failWritesFor = new Set<string>();

    async requireWorkspace(_userId: string, organizationId?: string | null) {
        return {
            type: "organization" as const,
            organizationId: organizationId ?? null,
            permissions: this.permissions,
        };
    }
    async readDeviceConfig(_u: string, _o: string | null | undefined, agentBindingId: string) {
        return { ...(this.configs.get(agentBindingId) ?? {}) };
    }
    async writeDeviceConfig(
        _u: string,
        _o: string | null | undefined,
        agentBindingId: string,
        config: Record<string, unknown>,
    ) {
        if (this.failWritesFor.has(agentBindingId)) throw new Error("设备离线");
        this.writes.push({ agentBindingId, config });
        this.configs.set(agentBindingId, { ...this.configs.get(agentBindingId), ...config });
    }
}

function buildKit() {
    const agents = new FakeRepo<Row>([
        {
            id: DEVICE_A,
            name: "小猫A",
            organizationId: ORG,
            ownerUserId: "t1",
            assignedUserId: "s1",
        },
        {
            id: DEVICE_B,
            name: "小猫B",
            organizationId: ORG,
            ownerUserId: "t1",
            assignedUserId: "s2",
        },
        { id: FOREIGN, name: "别班的猫", organizationId: "org-2", ownerUserId: "t9" },
    ]);
    const sessions = new FakeRepo<Row>();
    const registry = new ClassroomToolRegistryService();
    const port = new FakePort();
    port.configs.set(DEVICE_A, { character: "你是A的猫", tts_voice: "voice-a" });
    port.configs.set(DEVICE_B, { character: "你是B的猫", tts_voice: "voice-b" });

    const kit = new ClassroomKitService(
        new FakeRepo<Row>([{ id: ORG, name: "三年二班", code: "C001" }]) as never,
        new FakeRepo<Row>([
            { id: "m1", organizationId: ORG, userId: "s1", roles: ["student"] },
            { id: "m2", organizationId: ORG, userId: "t1", roles: ["teacher"] },
        ]) as never,
        new FakeRepo<Row>([
            { id: "s1", nickname: "小明", username: "xm", avatar: "" },
            { id: "t1", nickname: "王老师", username: "wang", avatar: "" },
        ]) as never,
        agents as never,
        new FakeRepo<Row>() as never,
        sessions as never,
        registry,
    );
    kit.useWorkspacePort(port);
    return { kit, port, registry, sessions, agents };
}

const caller: ClassroomCaller = {
    userId: "t1",
    organizationId: ORG,
    extensionIdentifier: "safe-cracker",
};

describe("ClassroomKitService", () => {
    it("snapshots every device before overwriting its prompt", async () => {
        const { kit, port, sessions } = buildKit();

        await kit.startSession(caller, {
            sessionKey: "game-1",
            agentBindingIds: [DEVICE_A, DEVICE_B],
            prompts: { [DEVICE_A]: "你守着密码 1111", [DEVICE_B]: "你守着密码 2222" },
        });

        // 快照落库的是接管**前**的人设，而不是刚下发的游戏人设。
        const snapshots = sessions.rows[0]?.configSnapshots as Record<string, Row>;
        expect(snapshots[DEVICE_A]?.character).toBe("你是A的猫");
        expect(snapshots[DEVICE_B]?.character).toBe("你是B的猫");
        expect(port.configs.get(DEVICE_A)?.character).toBe("你守着密码 1111");
    });

    it("restores each device to its own snapshot, not a shared one", async () => {
        const { kit, port } = buildKit();
        await kit.startSession(caller, {
            sessionKey: "game-1",
            agentBindingIds: [DEVICE_A, DEVICE_B],
            prompts: { [DEVICE_A]: "你守着密码 1111", [DEVICE_B]: "你守着密码 2222" },
        });

        await kit.endSession(caller, "game-1");

        // 每个学生的音色/人设本来就不同，恢复必须逐台还原。
        expect(port.configs.get(DEVICE_A)?.character).toBe("你是A的猫");
        expect(port.configs.get(DEVICE_A)?.tts_voice).toBe("voice-a");
        expect(port.configs.get(DEVICE_B)?.character).toBe("你是B的猫");
        expect(port.configs.get(DEVICE_B)?.tts_voice).toBe("voice-b");
    });

    it("unregisters the session's tools when the session ends", async () => {
        const { kit, registry } = buildKit();
        await kit.startSession(caller, {
            sessionKey: "game-1",
            agentBindingIds: [DEVICE_A],
            tools: [{ name: "safe_unlock_attempt", handler: () => "ok" }],
            suppressClassroomTool: true,
        });

        expect(registry.listToolsFor(DEVICE_A).map((tool) => tool.name)).toEqual([
            "safe_unlock_attempt",
        ]);
        expect(registry.isClassroomToolSuppressed(DEVICE_A)).toBe(true);

        await kit.endSession(caller, "game-1");

        expect(registry.listToolsFor(DEVICE_A)).toEqual([]);
        expect(registry.isClassroomToolSuppressed(DEVICE_A)).toBe(false);
    });

    it("appends to the existing prompt instead of replacing the teacher's persona", async () => {
        const { kit, port } = buildKit();

        await kit.appendPrompt(caller, [DEVICE_A], "完成任务后请调用 safe_unlock_attempt 上报。");

        expect(port.configs.get(DEVICE_A)?.character).toBe(
            "你是A的猫\n\n完成任务后请调用 safe_unlock_attempt 上报。",
        );
    });

    it("does not stack the same snippet when appended twice", async () => {
        const { kit, port } = buildKit();

        await kit.appendPrompt(caller, [DEVICE_A], "记得上报。");
        await kit.appendPrompt(caller, [DEVICE_A], "记得上报。");

        expect(port.configs.get(DEVICE_A)?.character).toBe("你是A的猫\n\n记得上报。");
    });

    it("rejects devices from another workspace", async () => {
        const { kit } = buildKit();

        await expect(
            kit.startSession(caller, {
                sessionKey: "game-1",
                agentBindingIds: [DEVICE_A, FOREIGN],
            }),
        ).rejects.toThrow("不属于当前工作空间");
    });

    it("reports per-device failures without aborting the batch", async () => {
        const { kit, port } = buildKit();
        port.failWritesFor.add(DEVICE_B);

        const results = await kit.applyPrompt(caller, {
            [DEVICE_A]: "新人设",
            [DEVICE_B]: "新人设",
        });

        expect(results.find((item) => item.agentBindingId === DEVICE_A)?.success).toBe(true);
        expect(results.find((item) => item.agentBindingId === DEVICE_B)?.success).toBe(false);
        expect(port.configs.get(DEVICE_A)?.character).toBe("新人设");
    });

    it("locks students out only while a locking session covers their device", async () => {
        const { kit } = buildKit();

        expect(await kit.isDeviceLockedForStudents(DEVICE_A)).toBe(false);

        await kit.startSession(caller, {
            sessionKey: "game-1",
            agentBindingIds: [DEVICE_A],
            lockStudentEdits: true,
        });
        expect(await kit.isDeviceLockedForStudents(DEVICE_A)).toBe(true);
        expect(await kit.isDeviceLockedForStudents(DEVICE_B)).toBe(false);

        await kit.endSession(caller, "game-1");
        expect(await kit.isDeviceLockedForStudents(DEVICE_A)).toBe(false);
    });

    it("restores devices when a forgotten session expires", async () => {
        const { kit, port, sessions, registry } = buildKit();
        await kit.startSession(caller, {
            sessionKey: "game-1",
            agentBindingIds: [DEVICE_A],
            prompts: { [DEVICE_A]: "你守着密码 1111" },
            lockStudentEdits: true,
        });
        // 老师直接关掉了页面：把到期时间挪到过去，模拟兜底清理。
        (sessions.rows[0] as Row).expiresAt = new Date(Date.now() - 1000);

        const { closed } = await kit.sweepExpiredSessions();

        expect(closed).toBe(1);
        expect(port.configs.get(DEVICE_A)?.character).toBe("你是A的猫");
        expect(registry.listToolsFor(DEVICE_A)).toEqual([]);
        expect(await kit.isDeviceLockedForStudents(DEVICE_A)).toBe(false);
    });

    it("restarting the same session key hands the devices back first", async () => {
        const { kit, port } = buildKit();
        await kit.startSession(caller, {
            sessionKey: "game-1",
            agentBindingIds: [DEVICE_A],
            prompts: { [DEVICE_A]: "第一局密码 1111" },
        });

        await kit.startSession(caller, {
            sessionKey: "game-1",
            agentBindingIds: [DEVICE_A],
            prompts: { [DEVICE_A]: "第二局密码 2222" },
        });

        // 第二局的快照必须是学生的原始人设，否则结束时会恢复成第一局的游戏人设。
        await kit.endSession(caller, "game-1");
        expect(port.configs.get(DEVICE_A)?.character).toBe("你是A的猫");
    });

    it("records which devices are under an app's control", async () => {
        const { kit } = buildKit();
        await kit.startSession(caller, { sessionKey: "game-1", agentBindingIds: [DEVICE_A] });

        const devices = await kit.listDevices(caller);
        const deviceA = devices.find((device) => device.agentBindingId === DEVICE_A);
        const deviceB = devices.find((device) => device.agentBindingId === DEVICE_B);

        expect(deviceA?.sessionIds).toHaveLength(1);
        expect(deviceB?.sessionIds).toEqual([]);
        expect(deviceA?.assignedUserName).toBe("小明");
    });

    it("fails loudly when the workspace implementation was never injected", async () => {
        const kit = new ClassroomKitService(
            new FakeRepo<Row>() as never,
            new FakeRepo<Row>() as never,
            new FakeRepo<Row>() as never,
            new FakeRepo<Row>() as never,
            new FakeRepo<Row>() as never,
            new FakeRepo<Row>() as never,
            new ClassroomToolRegistryService(),
        );

        await expect(kit.listDevices(caller)).rejects.toThrow("尚未接入工作空间实现");
    });

    /**
     * ClassroomKit 住在 packages/core，不能反向 import 组织模块的权限枚举，所以它
     * 自带了一份同值字面量。两边一旦漂移，应用调课堂能力时会拿着一个永远匹配不上的
     * 权限串，表现是「明明是老师却提示没权限」—— 很难查。用测试钉住。
     */
    it("keeps its permission literals aligned with the organization enum", () => {
        expect(ClassroomKitPermission.ASSET_READ).toBe(OrganizationPermission.ASSET_READ);
        expect(ClassroomKitPermission.ASSET_MANAGE).toBe(OrganizationPermission.ASSET_MANAGE);
        expect(ClassroomKitPermission.MEMBER_READ).toBe(OrganizationPermission.MEMBER_READ);
    });
});
