import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    ClassroomAppSession,
    ClassroomAppSessionStatus,
    Organization,
    OrganizationMember,
    type OrganizationRoleType,
    User,
    XiaozhiAgentBinding,
    XiaozhiMcpConnection,
    XiaozhiMcpConnectionStatus,
} from "@buildingai/db/entities";
import { In, IsNull, LessThanOrEqual, Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger } from "@nestjs/common";

import { CLASSROOM_PROMPT_KEY, pickClassroomConfig } from "./classroom-config-keys";
import {
    type ClassroomToolDefinition,
    ClassroomToolRegistryService,
} from "./classroom-tool-registry.service";
import {
    ClassroomKitPermission,
    type ClassroomWorkspaceAccess,
    ClassroomWorkspacePort,
} from "./classroom-workspace.port";

/** 谁在调用课堂能力。工作空间由 organizationId 决定，null 表示个人空间。 */
export type ClassroomCaller = {
    userId: string;
    organizationId: string | null;
    /** 调用方应用标识，用于会话归属与排障。 */
    extensionIdentifier: string;
};

export type ClassroomInfo = {
    organizationId: string | null;
    name: string;
    code: string | null;
    isPersonal: boolean;
    memberCount: number;
    deviceCount: number;
    /** 调用者自己在这个班里的身份。 */
    self: { userId: string; roles: OrganizationRoleType[]; canManage: boolean };
};

export type ClassroomMember = {
    userId: string;
    nickname: string;
    username: string;
    avatar: string;
    roles: OrganizationRoleType[];
    isTeacher: boolean;
    /** 分发给该成员的方糖猫。 */
    agentBindingIds: string[];
};

export type ClassroomDevice = {
    agentBindingId: string;
    name: string;
    organizationId: string | null;
    ownerUserId: string;
    assignedUserId: string | null;
    assignedUserName: string | null;
    model: string | null;
    voice: string | null;
    deviceCount: number;
    onlineDeviceCount: number;
    /** MCP 通道是否已连上；没接入 MCP 时为 null。 */
    mcpConnected: boolean | null;
    /** 老师长期锁定的配置项，与课堂会话的临时锁定是两件事。 */
    lockedConfigKeys: string[];
    /** 当前是否被某个课堂应用会话接管。 */
    sessionIds: string[];
};

export type ClassroomSessionView = {
    id: string;
    sessionKey: string;
    extensionIdentifier: string;
    title: string;
    organizationId: string | null;
    ownerUserId: string;
    status: string;
    agentBindingIds: string[];
    lockStudentEdits: boolean;
    suppressClassroomTool: boolean;
    metadata: Record<string, unknown>;
    expiresAt: Date | null;
    startedAt: Date;
    endedAt: Date | null;
};

export type StartClassroomSessionInput = {
    /** 应用自定义的会话标识，在同一应用内唯一。 */
    sessionKey: string;
    title?: string;
    /** 参与本次活动的方糖猫。 */
    agentBindingIds: string[];
    /** 挂到这批设备上的 MCP 工具。 */
    tools?: ClassroomToolDefinition[];
    /** 会话期间隐藏内置的 classroom_report_completion，避免与应用工具语义打架。 */
    suppressClassroomTool?: boolean;
    /** 会话期间禁止学生改自己的方糖猫。 */
    lockStudentEdits?: boolean;
    /** 逐设备覆盖提示词。 */
    prompts?: Record<string, string>;
    /** 在各设备现有提示词后追加一段（与 prompts 二选一，prompts 优先）。 */
    appendPrompt?: string;
    /** 除提示词外要一并下发的配置。 */
    config?: Record<string, unknown>;
    /** 超时自动结束，兜住老师忘记结束和应用崩溃两种情况。 */
    durationMinutes?: number;
    metadata?: Record<string, unknown>;
};

export type ClassroomApplyResult = {
    agentBindingId: string;
    name: string;
    success: boolean;
    message?: string;
};

const APPLY_CONCURRENCY = 4;
const DEFAULT_SESSION_MINUTES = 180;

async function mapLimit<T, R>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await task(items[index] as T);
        }
    });
    await Promise.all(workers);
    return results;
}

/**
 * 课堂能力层：已安装应用读班级、读设备、写提示词、接管与归还设备的统一入口。
 *
 * 应用本可以直接注入仓储乱来 —— 这一层的价值不在于"能做到"，而在于每个方法
 * 第一行都会做工作空间权限断言，并且接管设备这件事有始有终：开始时快照、
 * 结束时恢复、超时兜底。应用自己拼 SQL 做不到这些保证。
 *
 * 由 `@Global()` 的 ClassroomKitModule 提供，与 MCP 网关共享同一个工具注册表。
 */
@Injectable()
export class ClassroomKitService {
    private readonly logger = new Logger(ClassroomKitService.name);
    private port: ClassroomWorkspacePort | null = null;

    constructor(
        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,
        @InjectRepository(OrganizationMember)
        private readonly memberRepository: Repository<OrganizationMember>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(XiaozhiAgentBinding)
        private readonly agentRepository: Repository<XiaozhiAgentBinding>,
        @InjectRepository(XiaozhiMcpConnection)
        private readonly mcpRepository: Repository<XiaozhiMcpConnection>,
        @InjectRepository(ClassroomAppSession)
        private readonly sessionRepository: Repository<ClassroomAppSession>,
        private readonly registry: ClassroomToolRegistryService,
    ) {}

    /**
     * 由 api 层在启动时注入权限与设备下发的实现。
     * core 不能反向依赖 api，所以用注入而不是 DI 覆盖。
     */
    useWorkspacePort(port: ClassroomWorkspacePort) {
        this.port = port;
    }

    private requirePort(): ClassroomWorkspacePort {
        if (!this.port) throw new Error("ClassroomKit 尚未接入工作空间实现");
        return this.port;
    }

    // ==================== 课堂信息 ====================

    /** 班级概况：名称、人数、设备数，以及调用者自己在班里的身份。 */
    async getClassroom(caller: ClassroomCaller): Promise<ClassroomInfo> {
        const access = await this.requireAccess(caller, ClassroomKitPermission.ASSET_READ);
        const deviceCount = await this.agentRepository.count({
            where: this.workspaceWhere(caller),
        });

        if (!caller.organizationId) {
            return {
                organizationId: null,
                name: "个人空间",
                code: null,
                isPersonal: true,
                memberCount: 1,
                deviceCount,
                self: { userId: caller.userId, roles: [], canManage: true },
            };
        }

        const [organization, memberCount, self] = await Promise.all([
            this.organizationRepository.findOne({ where: { id: caller.organizationId } }),
            this.memberRepository.count({ where: { organizationId: caller.organizationId } }),
            this.memberRepository.findOne({
                where: { organizationId: caller.organizationId, userId: caller.userId },
            }),
        ]);

        return {
            organizationId: caller.organizationId,
            name: organization?.name ?? "",
            code: organization?.code ?? null,
            isPersonal: false,
            memberCount,
            deviceCount,
            self: {
                userId: caller.userId,
                roles: self?.roles ?? [],
                canManage: this.canManage(access),
            },
        };
    }

    /** 班级成员，附带每人分到的方糖猫。 */
    async listMembers(caller: ClassroomCaller): Promise<ClassroomMember[]> {
        await this.requireAccess(
            caller,
            caller.organizationId ? ClassroomKitPermission.MEMBER_READ : undefined,
        );
        if (!caller.organizationId) return [];

        const members = await this.memberRepository.find({
            where: { organizationId: caller.organizationId },
        });
        if (!members.length) return [];

        const [users, agents] = await Promise.all([
            this.userRepository.find({
                where: { id: In(members.map((member) => member.userId)) },
                select: ["id", "nickname", "username", "avatar"],
            }),
            this.agentRepository.find({
                where: { organizationId: caller.organizationId },
                select: ["id", "assignedUserId"],
            }),
        ]);

        const userById = new Map(users.map((user) => [user.id, user]));
        const agentsByUser = new Map<string, string[]>();
        for (const agent of agents) {
            if (!agent.assignedUserId) continue;
            const bucket = agentsByUser.get(agent.assignedUserId) ?? [];
            bucket.push(agent.id);
            agentsByUser.set(agent.assignedUserId, bucket);
        }

        return members.map((member) => {
            const user = userById.get(member.userId);
            return {
                userId: member.userId,
                nickname: user?.nickname ?? "",
                username: user?.username ?? "",
                avatar: user?.avatar ?? "",
                roles: member.roles ?? [],
                isTeacher: (member.roles ?? []).some((role) => role !== "student"),
                agentBindingIds: agentsByUser.get(member.userId) ?? [],
            };
        });
    }

    // ==================== 设备信息 ====================

    /** 工作空间内的方糖猫，附带 MCP 连接状态、分发对象与当前接管情况。 */
    async listDevices(
        caller: ClassroomCaller,
        filter: { assignedUserId?: string | null } = {},
    ): Promise<ClassroomDevice[]> {
        await this.requireAccess(caller, ClassroomKitPermission.ASSET_READ);
        const where = this.workspaceWhere(caller);
        const agents = await this.agentRepository.find({
            where:
                filter.assignedUserId === undefined
                    ? where
                    : { ...where, assignedUserId: filter.assignedUserId ?? IsNull() },
            order: { name: "ASC" },
        });
        return this.decorateDevices(agents);
    }

    async getDevice(caller: ClassroomCaller, agentBindingId: string): Promise<ClassroomDevice> {
        await this.requireAccess(caller, ClassroomKitPermission.ASSET_READ);
        const agent = await this.agentRepository.findOne({
            where: { id: agentBindingId, ...this.workspaceWhere(caller) },
        });
        if (!agent) throw new Error("方糖猫不存在或不属于当前工作空间");
        const [device] = await this.decorateDevices([agent]);
        return device as ClassroomDevice;
    }

    private async decorateDevices(agents: XiaozhiAgentBinding[]): Promise<ClassroomDevice[]> {
        if (!agents.length) return [];
        const assignedIds = [
            ...new Set(agents.map((agent) => agent.assignedUserId).filter(Boolean)),
        ] as string[];
        const [connections, users] = await Promise.all([
            this.mcpRepository.find({
                where: { agentBindingId: In(agents.map((agent) => agent.id)) },
                select: ["agentBindingId", "status", "enabled"],
            }),
            assignedIds.length
                ? this.userRepository.find({
                      where: { id: In(assignedIds) },
                      select: ["id", "nickname", "username"],
                  })
                : Promise.resolve([]),
        ]);

        const connectionByAgent = new Map(
            connections.map((connection) => [connection.agentBindingId, connection]),
        );
        const userById = new Map(users.map((user) => [user.id, user]));

        return agents.map((agent) => {
            const connection = connectionByAgent.get(agent.id);
            const assignedUser = agent.assignedUserId
                ? userById.get(agent.assignedUserId)
                : undefined;
            return {
                agentBindingId: agent.id,
                name: agent.name,
                organizationId: agent.organizationId,
                ownerUserId: agent.ownerUserId,
                assignedUserId: agent.assignedUserId,
                assignedUserName: assignedUser?.nickname || assignedUser?.username || null,
                model: agent.model,
                voice: agent.voice,
                deviceCount: agent.deviceCount,
                onlineDeviceCount: agent.onlineDeviceCount,
                mcpConnected: connection
                    ? connection.enabled &&
                      connection.status === XiaozhiMcpConnectionStatus.CONNECTED
                    : null,
                lockedConfigKeys: agent.lockedConfigKeys ?? [],
                sessionIds: this.registry.listSessionIdsFor(agent.id),
            };
        });
    }

    // ==================== 提示词与配置 ====================

    /** 读一台方糖猫当前的课堂相关配置（含提示词）。 */
    async readDeviceConfig(caller: ClassroomCaller, agentBindingId: string) {
        await this.requireAccess(caller, ClassroomKitPermission.ASSET_READ);
        await this.resolveAgents(caller, [agentBindingId]);
        const config = await this.requirePort().readDeviceConfig(
            caller.userId,
            caller.organizationId,
            agentBindingId,
        );
        return pickClassroomConfig(config);
    }

    /**
     * 逐设备下发配置。单台失败不打断整批，与场景下发的行为一致 ——
     * 一个班里总有几台设备离线，因为一台失败就整批回滚在课堂上没有意义。
     */
    async applyDeviceConfig(
        caller: ClassroomCaller,
        targets: Array<{ agentBindingId: string; config: Record<string, unknown> }>,
    ): Promise<ClassroomApplyResult[]> {
        await this.requireAccess(caller, ClassroomKitPermission.ASSET_MANAGE);
        const agents = await this.resolveAgents(
            caller,
            targets.map((target) => target.agentBindingId),
        );
        return this.pushConfigs(caller.userId, caller.organizationId, agents, targets);
    }

    /** 覆盖提示词。key 是设备ID，value 是完整的新人设。 */
    async applyPrompt(caller: ClassroomCaller, prompts: Record<string, string>) {
        return this.applyDeviceConfig(
            caller,
            Object.entries(prompts).map(([agentBindingId, character]) => ({
                agentBindingId,
                config: { [CLASSROOM_PROMPT_KEY]: character },
            })),
        );
    }

    /**
     * 在现有提示词后追加一段，而不是整段覆盖。
     *
     * 方糖猫只认提示词和工具表两样东西，应用要让模型知道"什么时候该调你的工具"
     * 就必须写进提示词；但直接覆盖会抹掉老师精心写的角色设定。追加是这两者
     * 之间唯一说得通的做法。
     */
    async appendPrompt(
        caller: ClassroomCaller,
        agentBindingIds: string[],
        snippet: string,
        separator = "\n\n",
    ): Promise<ClassroomApplyResult[]> {
        await this.requireAccess(caller, ClassroomKitPermission.ASSET_MANAGE);
        const agents = await this.resolveAgents(caller, agentBindingIds);
        const port = this.requirePort();

        const targets = await mapLimit(agents, APPLY_CONCURRENCY, async (agent) => {
            const current = await port.readDeviceConfig(
                caller.userId,
                caller.organizationId,
                agent.id,
            );
            const existing = String(current[CLASSROOM_PROMPT_KEY] ?? "");
            // 已经追加过就不再重复追加，允许应用反复调用而不叠加。
            const character = existing.includes(snippet)
                ? existing
                : existing
                  ? `${existing}${separator}${snippet}`
                  : snippet;
            return { agentBindingId: agent.id, config: { [CLASSROOM_PROMPT_KEY]: character } };
        });

        return this.pushConfigs(caller.userId, caller.organizationId, agents, targets);
    }

    private async pushConfigs(
        userId: string,
        organizationId: string | null,
        agents: XiaozhiAgentBinding[],
        targets: Array<{ agentBindingId: string; config: Record<string, unknown> }>,
    ): Promise<ClassroomApplyResult[]> {
        const nameById = new Map(agents.map((agent) => [agent.id, agent.name]));
        const port = this.requirePort();
        return mapLimit(targets, APPLY_CONCURRENCY, async (target) => {
            const name = nameById.get(target.agentBindingId) ?? "";
            try {
                await port.writeDeviceConfig(
                    userId,
                    organizationId,
                    target.agentBindingId,
                    pickClassroomConfig(target.config),
                );
                return { agentBindingId: target.agentBindingId, name, success: true };
            } catch (error) {
                return {
                    agentBindingId: target.agentBindingId,
                    name,
                    success: false,
                    message: error instanceof Error ? error.message : "下发失败",
                };
            }
        });
    }

    // ==================== 会话生命周期 ====================

    /**
     * 开启一次接管：快照现有配置 → 落库 → 下发新提示词 → 挂载应用工具。
     *
     * 顺序是刻意的：快照必须在下发之前落库，否则下发到一半崩了就再也恢复不回来。
     */
    async startSession(
        caller: ClassroomCaller,
        input: StartClassroomSessionInput,
    ): Promise<{ session: ClassroomSessionView; applied: ClassroomApplyResult[] }> {
        await this.requireAccess(caller, ClassroomKitPermission.ASSET_MANAGE);
        if (!input.sessionKey?.trim()) throw new Error("sessionKey 不能为空");
        const agents = await this.resolveAgents(caller, input.agentBindingIds);
        if (!agents.length) throw new Error("至少需要指定一台方糖猫");

        // 同 key 的旧会话先正常结束（含恢复），让应用可以直接重开一局而不残留接管状态。
        const previous = await this.sessionRepository.findOne({
            where: {
                extensionIdentifier: caller.extensionIdentifier,
                sessionKey: input.sessionKey,
                status: ClassroomAppSessionStatus.ACTIVE,
            },
        });
        if (previous) await this.closeSession(previous);

        const port = this.requirePort();
        const snapshots: Record<string, Record<string, unknown>> = {};
        await mapLimit(agents, APPLY_CONCURRENCY, async (agent) => {
            try {
                const config = await port.readDeviceConfig(
                    caller.userId,
                    caller.organizationId,
                    agent.id,
                );
                snapshots[agent.id] = pickClassroomConfig(config);
            } catch (error) {
                // 快照不到就不接管这台设备 —— 改了却恢复不回来，比少接管一台糟糕得多。
                this.logger.warn(
                    `Snapshot failed for device ${agent.id}: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        });

        const snapshotted = agents.filter((agent) => agent.id in snapshots);
        if (!snapshotted.length) throw new Error("没有任何设备可以读取配置，无法开始会话");

        const durationMinutes = input.durationMinutes ?? DEFAULT_SESSION_MINUTES;
        const session = await this.sessionRepository.save(
            this.sessionRepository.create({
                extensionIdentifier: caller.extensionIdentifier,
                sessionKey: input.sessionKey.trim(),
                organizationId: caller.organizationId,
                ownerUserId: caller.userId,
                title: input.title?.slice(0, 120) ?? "",
                status: ClassroomAppSessionStatus.ACTIVE,
                agentBindingIds: snapshotted.map((agent) => agent.id),
                configSnapshots: snapshots,
                lockStudentEdits: input.lockStudentEdits ?? false,
                suppressClassroomTool: input.suppressClassroomTool ?? false,
                metadata: input.metadata ?? {},
                expiresAt:
                    durationMinutes > 0 ? new Date(Date.now() + durationMinutes * 60_000) : null,
            }),
        );

        // 先挂工具再改提示词：提示词里若写了"用工具上报"，工具必须已经在表里，
        // 否则设备可能在两者之间的窗口里读到一份指向不存在工具的人设。
        this.registry.registerSession(session.id, session.agentBindingIds, input.tools ?? [], {
            suppressClassroomTool: session.suppressClassroomTool,
        });

        let applied: ClassroomApplyResult[] = [];
        const scopedCaller = { ...caller, organizationId: caller.organizationId };
        if (input.prompts && Object.keys(input.prompts).length) {
            const targets = snapshotted
                .filter((agent) => input.prompts?.[agent.id] !== undefined)
                .map((agent) => ({
                    agentBindingId: agent.id,
                    config: {
                        ...(input.config ?? {}),
                        [CLASSROOM_PROMPT_KEY]: input.prompts?.[agent.id] as string,
                    },
                }));
            applied = await this.pushConfigs(
                scopedCaller.userId,
                scopedCaller.organizationId,
                snapshotted,
                targets,
            );
        } else if (input.appendPrompt) {
            applied = await this.appendPrompt(
                scopedCaller,
                snapshotted.map((agent) => agent.id),
                input.appendPrompt,
            );
        } else if (input.config && Object.keys(input.config).length) {
            applied = await this.pushConfigs(
                scopedCaller.userId,
                scopedCaller.organizationId,
                snapshotted,
                snapshotted.map((agent) => ({
                    agentBindingId: agent.id,
                    config: input.config as Record<string, unknown>,
                })),
            );
        }

        return { session: this.toSessionView(session), applied };
    }

    /**
     * 会话进行中调整工具或设备范围，不重新快照。
     * 服务重启后应用也用它把工具重新挂回来（handler 是函数，无法持久化）。
     */
    async rearmSession(
        caller: ClassroomCaller,
        sessionKey: string,
        tools: ClassroomToolDefinition[],
        agentBindingIds?: string[],
    ): Promise<ClassroomSessionView> {
        await this.requireAccess(caller, ClassroomKitPermission.ASSET_MANAGE);
        const session = await this.requireActiveSession(caller.extensionIdentifier, sessionKey);
        if (agentBindingIds) {
            const agents = await this.resolveAgents(caller, agentBindingIds);
            session.agentBindingIds = agents.map((agent) => agent.id);
            await this.sessionRepository.save(session);
        }
        this.registry.registerSession(session.id, session.agentBindingIds, tools, {
            suppressClassroomTool: session.suppressClassroomTool,
        });
        return this.toSessionView(session);
    }

    /** 结束接管：恢复每台设备的原配置、注销工具、解除锁定。 */
    async endSession(caller: ClassroomCaller, sessionKey: string) {
        await this.requireAccess(caller, ClassroomKitPermission.ASSET_MANAGE);
        const session = await this.requireActiveSession(caller.extensionIdentifier, sessionKey);
        return this.closeSession(session);
    }

    async getSession(
        caller: ClassroomCaller,
        sessionKey: string,
    ): Promise<ClassroomSessionView | null> {
        await this.requireAccess(caller, ClassroomKitPermission.ASSET_READ);
        const session = await this.sessionRepository.findOne({
            where: { extensionIdentifier: caller.extensionIdentifier, sessionKey },
            order: { createdAt: "DESC" },
        });
        return session ? this.toSessionView(session) : null;
    }

    /** 应用重启后用它找回还没结束的会话，再逐个 rearmSession 挂回工具。 */
    async listActiveSessions(extensionIdentifier: string): Promise<ClassroomSessionView[]> {
        const sessions = await this.sessionRepository.find({
            where: { extensionIdentifier, status: ClassroomAppSessionStatus.ACTIVE },
            order: { createdAt: "DESC" },
        });
        return sessions.map((session) => this.toSessionView(session));
    }

    /**
     * 结束所有已超时的会话。
     *
     * 这是整套接管机制的安全网：老师直接关掉页面、应用崩溃再没回来、
     * 服务重启后没人 rearm —— 任何一种情况下，学生的方糖猫都不会被永久
     * 留在应用改写的人设上。
     */
    async sweepExpiredSessions() {
        const expired = await this.sessionRepository.find({
            where: {
                status: ClassroomAppSessionStatus.ACTIVE,
                expiresAt: LessThanOrEqual(new Date()),
            },
        });
        for (const session of expired) {
            try {
                await this.closeSession(session);
                this.logger.log(`Classroom session ${session.id} expired and was restored`);
            } catch (error) {
                this.logger.error(
                    `Failed to close expired session ${session.id}: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
            }
        }
        return { closed: expired.length };
    }

    /**
     * 恢复 + 注销 + 落状态。以会话发起人的身份下发恢复配置，
     * 这样超时清理（没有调用者上下文）走的也是同一条权限路径。
     */
    private async closeSession(session: ClassroomAppSession) {
        const results: ClassroomApplyResult[] = [];
        if (this.port) {
            const agents = await this.agentRepository.find({
                where: { id: In(session.agentBindingIds.length ? session.agentBindingIds : [""]) },
            });
            const targets = agents
                .filter((agent) => session.configSnapshots[agent.id])
                .map((agent) => ({
                    agentBindingId: agent.id,
                    config: session.configSnapshots[agent.id] as Record<string, unknown>,
                }));
            results.push(
                ...(await this.pushConfigs(
                    session.ownerUserId,
                    session.organizationId,
                    agents,
                    targets,
                )),
            );
        }

        this.registry.unregisterSession(session.id);

        const failed = results.filter((result) => !result.success);
        session.status = ClassroomAppSessionStatus.ENDED;
        session.endedAt = new Date();
        session.restoreError = failed.length
            ? failed
                  .map((item) => `${item.name || item.agentBindingId}: ${item.message}`)
                  .join("; ")
            : null;
        await this.sessionRepository.save(session);

        return {
            session: this.toSessionView(session),
            restored: results.length - failed.length,
            failed: failed.length,
            results,
        };
    }

    // ==================== 学生端锁定 ====================

    /**
     * 这台方糖猫当前是否被某个会话锁住，禁止学生自行修改。
     *
     * 只在非管理者写配置时才会走到这里，所以查库的代价可以接受，
     * 也省掉了内存缓存的失效问题。
     */
    async isDeviceLockedForStudents(agentBindingId: string): Promise<boolean> {
        const sessions = await this.sessionRepository.find({
            where: { status: ClassroomAppSessionStatus.ACTIVE, lockStudentEdits: true },
            select: ["id", "agentBindingIds"],
        });
        return sessions.some((session) => session.agentBindingIds?.includes(agentBindingId));
    }

    // ==================== 内部工具 ====================

    private async requireAccess(
        caller: ClassroomCaller,
        permission?: (typeof ClassroomKitPermission)[keyof typeof ClassroomKitPermission],
    ) {
        return this.requirePort().requireWorkspace(
            caller.userId,
            caller.organizationId,
            caller.organizationId ? permission : undefined,
        );
    }

    private canManage(access: ClassroomWorkspaceAccess) {
        return (
            access.type === "personal" ||
            access.permissions.includes(ClassroomKitPermission.ASSET_MANAGE)
        );
    }

    private workspaceWhere(caller: ClassroomCaller) {
        return caller.organizationId
            ? { organizationId: caller.organizationId }
            : { organizationId: IsNull(), ownerUserId: caller.userId };
    }

    /** 把设备ID解析成实体，顺带挡掉不属于本工作空间的设备。 */
    private async resolveAgents(caller: ClassroomCaller, agentBindingIds: string[]) {
        const unique = [...new Set(agentBindingIds.filter(Boolean))];
        if (!unique.length) return [];
        const agents = await this.agentRepository.find({
            where: { id: In(unique), ...this.workspaceWhere(caller) },
        });
        if (agents.length !== unique.length) {
            throw new Error("部分方糖猫不存在或不属于当前工作空间");
        }
        return agents;
    }

    private async requireActiveSession(extensionIdentifier: string, sessionKey: string) {
        const session = await this.sessionRepository.findOne({
            where: {
                extensionIdentifier,
                sessionKey,
                status: ClassroomAppSessionStatus.ACTIVE,
            },
        });
        if (!session) throw new Error("会话不存在或已结束");
        return session;
    }

    private toSessionView(session: ClassroomAppSession): ClassroomSessionView {
        return {
            id: session.id,
            sessionKey: session.sessionKey,
            extensionIdentifier: session.extensionIdentifier,
            title: session.title,
            organizationId: session.organizationId,
            ownerUserId: session.ownerUserId,
            status: session.status,
            agentBindingIds: session.agentBindingIds ?? [],
            lockStudentEdits: session.lockStudentEdits,
            suppressClassroomTool: session.suppressClassroomTool,
            metadata: session.metadata ?? {},
            expiresAt: session.expiresAt,
            startedAt: session.createdAt,
            endedAt: session.endedAt,
        };
    }
}
