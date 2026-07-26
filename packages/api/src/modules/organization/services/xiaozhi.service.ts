import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    XiaozhiAccount,
    XiaozhiAccountStatus,
    XiaozhiAgentBinding,
} from "@buildingai/db/entities";
import { IsNull, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";

import { OrganizationPermission } from "../constants/organization-permissions";
import {
    type MappedDevice,
    mapUpstreamChat,
    mapUpstreamChatMessage,
    mapUpstreamDevice,
    summarizeDevices,
    type UpstreamChatMessagePayload,
    type UpstreamChatPayload,
    type UpstreamDevicePayload,
} from "../constants/xiaozhi-mappers";
import type { BindXiaozhiAccountDto } from "../dto/organization.dto";
import { OrganizationService } from "./organization.service";

type LoginChallenge = {
    userId: string;
    cookie: string;
    expiresAt: number;
};

type UpstreamAgent = {
    id: number | string;
    agent_name?: string | null;
    llm_model?: string | null;
    tts_voice?: string | null;
    deviceCount?: number;
    onlineDeviceCount?: number;
    lastDevice?: { last_connected_at?: string | null } | null;
};

type UpstreamPayload<T> = {
    data?: T;
    pagination?: { hasMore?: boolean; total?: number; page?: number; totalPages?: number };
    message?: string;
    error?: string;
};


@Injectable()
export class XiaozhiService {
    private readonly challenges = new Map<string, LoginChallenge>();
    private readonly baseUrl = (process.env.XIAOZHI_API_BASE || "https://xiaozhi.me/api").replace(
        /\/$/,
        "",
    );
    private readonly encryptionKey = createHash("sha256")
        .update(
            process.env.XIAOZHI_ENCRYPTION_KEY ||
                process.env.JWT_SECRET ||
                "BuildingAI-xiaozhi-development-key",
        )
        .digest();

    constructor(
        @InjectRepository(XiaozhiAccount)
        private readonly accountRepository: Repository<XiaozhiAccount>,
        @InjectRepository(XiaozhiAgentBinding)
        private readonly agentRepository: Repository<XiaozhiAgentBinding>,
        private readonly organizationService: OrganizationService,
    ) {}

    async getCaptcha(userId: string) {
        this.cleanupChallenges();
        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}/auth/captcha`, {
                headers: { Accept: "image/svg+xml,text/plain" },
            });
        } catch {
            throw HttpErrorFactory.badGateway("无法连接小智验证码服务");
        }
        const svg = await response.text();
        if (!response.ok) throw HttpErrorFactory.badGateway("无法获取小智图形验证码");

        const challengeId = randomUUID();
        const expiresAt = Date.now() + 5 * 60_000;
        this.challenges.set(challengeId, {
            userId,
            cookie: this.readSetCookies(response.headers),
            expiresAt,
        });
        return {
            challengeId,
            image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
            expiresAt: new Date(expiresAt).toISOString(),
        };
    }

    async bindAccount(
        userId: string,
        organizationId: string | null | undefined,
        dto: BindXiaozhiAccountDto,
    ) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            organizationId ? OrganizationPermission.ASSET_MANAGE : undefined,
        );
        const login = await this.loginUpstream(userId, {
            username: dto.username.trim(),
            password: dto.password,
            captchaCode: dto.captchaCode,
            challengeId: dto.challengeId,
        });
        const account = await this.accountRepository.save(
            this.accountRepository.create({
                organizationId: organizationId || null,
                ownerUserId: userId,
                label: dto.label.trim(),
                usernameEncrypted: this.encrypt(dto.username.trim()),
                passwordEncrypted: this.encrypt(dto.password),
                accessTokenEncrypted: this.encrypt(login.token),
                sessionCookieEncrypted: login.sessionCookie
                    ? this.encrypt(login.sessionCookie)
                    : null,
                upstreamUserId: login.upstreamUserId,
                status: XiaozhiAccountStatus.ACTIVE,
                lastSyncAt: null,
                lastError: null,
            }),
        );
        try {
            await this.syncAccount(userId, organizationId, account.id);
        } catch {
            // Authentication already succeeded. Keep the encrypted binding so
            // transient upstream errors can be retried without re-entering credentials.
        }
        const current = await this.accountRepository.findOne({ where: { id: account.id } });
        return this.toPublicAccount(current || account);
    }

    async listAccounts(userId: string, organizationId?: string | null) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            organizationId ? OrganizationPermission.ASSET_READ : undefined,
        );
        const accounts = await this.accountRepository.find({
            where: organizationId
                ? { organizationId }
                : { organizationId: IsNull(), ownerUserId: userId },
            order: { createdAt: "ASC" },
        });
        return accounts.map((account) => this.toPublicAccount(account));
    }

    async listAgents(userId: string, organizationId?: string | null) {
        const access = await this.organizationService.requireWorkspace(userId, organizationId);
        if (access.type === "organization") {
            const canReadAll = access.permissions.includes(OrganizationPermission.ASSET_READ);
            return this.agentRepository.find({
                where: canReadAll
                    ? { organizationId: access.organizationId }
                    : { organizationId: access.organizationId, assignedUserId: userId },
                order: { name: "ASC" },
            });
        }
        return this.agentRepository.find({
            where: { organizationId: IsNull(), ownerUserId: userId },
            order: { name: "ASC" },
        });
    }

    /** Consume a captcha challenge and log into the upstream console. */
    private async loginUpstream(
        userId: string,
        input: { username: string; password: string; captchaCode: string; challengeId: string },
    ) {
        this.cleanupChallenges();
        const challenge = this.challenges.get(input.challengeId);
        if (!challenge || challenge.userId !== userId) {
            throw HttpErrorFactory.badRequest("验证码已过期，请刷新后重试");
        }
        this.challenges.delete(input.challengeId);

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}/auth/login`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Cookie: challenge.cookie,
                },
                body: JSON.stringify({
                    username: input.username,
                    password: input.password,
                    captcha_code: input.captchaCode.trim(),
                }),
            });
        } catch {
            throw HttpErrorFactory.badGateway("无法连接小智登录服务");
        }
        const payload = (await this.parseResponse(response)) as UpstreamPayload<{
            token?: string;
            user?: Record<string, unknown>;
        }>;
        if (!response.ok || !payload.data?.token) {
            throw HttpErrorFactory.badRequest(
                payload.message || payload.error || "小智账号登录失败",
            );
        }

        const upstreamUser = payload.data.user || {};
        const upstreamUserId = upstreamUser.id ?? upstreamUser.user_id ?? null;
        return {
            token: payload.data.token,
            sessionCookie: this.mergeCookies(
                challenge.cookie,
                this.readSetCookies(response.headers),
            ),
            upstreamUserId: upstreamUserId === null ? null : String(upstreamUserId),
        };
    }

    /** Resolve one account inside the caller's workspace; managers only. */
    private async resolveManagedAccount(
        userId: string,
        organizationId: string | null | undefined,
        accountId: string,
    ) {
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            organizationId ? OrganizationPermission.ASSET_MANAGE : undefined,
        );
        const account = await this.accountRepository.findOne({
            where: organizationId
                ? { id: accountId, organizationId }
                : { id: accountId, organizationId: IsNull(), ownerUserId: userId },
        });
        if (!account) throw HttpErrorFactory.notFound("小智账号不存在");
        return account;
    }

    async reconnectAccount(
        userId: string,
        organizationId: string | null | undefined,
        accountId: string,
        dto: { password?: string; captchaCode: string; challengeId: string },
    ) {
        const account = await this.resolveManagedAccount(userId, organizationId, accountId);
        const password = dto.password || this.decrypt(account.passwordEncrypted);
        const login = await this.loginUpstream(userId, {
            username: this.decrypt(account.usernameEncrypted),
            password,
            captchaCode: dto.captchaCode,
            challengeId: dto.challengeId,
        });
        account.passwordEncrypted = this.encrypt(password);
        account.accessTokenEncrypted = this.encrypt(login.token);
        account.sessionCookieEncrypted = login.sessionCookie
            ? this.encrypt(login.sessionCookie)
            : null;
        account.upstreamUserId = login.upstreamUserId ?? account.upstreamUserId;
        account.status = XiaozhiAccountStatus.ACTIVE;
        account.lastError = null;
        await this.accountRepository.save(account);
        try {
            await this.syncAccount(userId, organizationId, account.id);
        } catch {
            // Login already succeeded; sync failures surface via account status.
        }
        const current = await this.accountRepository.findOne({ where: { id: account.id } });
        return this.toPublicAccount(current || account);
    }

    async updateAccountLabel(
        userId: string,
        organizationId: string | null | undefined,
        accountId: string,
        label: string,
    ) {
        const account = await this.resolveManagedAccount(userId, organizationId, accountId);
        account.label = label.trim();
        await this.accountRepository.save(account);
        return this.toPublicAccount(account);
    }

    /**
     * Remove the local binding only — the upstream xiaozhi account and its
     * agents/devices stay untouched and can be re-bound later.
     */
    async removeAccount(
        userId: string,
        organizationId: string | null | undefined,
        accountId: string,
    ) {
        const account = await this.resolveManagedAccount(userId, organizationId, accountId);
        const agents = await this.agentRepository.find({
            where: { xiaozhiAccountId: account.id },
        });
        if (agents.length) await this.agentRepository.softRemove(agents);
        await this.accountRepository.softRemove(account);
        return { success: true, removed: account.label };
    }

    async deleteAgent(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId, true);
        await this.request(account, "/agents/delete", {
            method: "POST",
            body: { id: Number(agent.upstreamAgentId) },
        });
        await this.agentRepository.softRemove(agent);
        return { success: true };
    }

    async syncAccount(
        userId: string,
        organizationId: string | null | undefined,
        accountId: string,
    ) {
        const account = await this.resolveManagedAccount(userId, organizationId, accountId);

        try {
            const agents: UpstreamAgent[] = [];
            for (let page = 1; page <= 50; page += 1) {
                const result = await this.request<UpstreamAgent[]>(
                    account,
                    `/agents?page=${page}&pageSize=100&summary=true`,
                );
                agents.push(...(result.data || []));
                if (!result.pagination?.hasMore) break;
            }

            const existing = await this.agentRepository.find({
                where: { xiaozhiAccountId: account.id },
            });
            const existingMap = new Map(existing.map((item) => [item.upstreamAgentId, item]));
            const saved = [];
            for (const agent of agents) {
                const upstreamAgentId = String(agent.id);
                const binding =
                    existingMap.get(upstreamAgentId) ||
                    this.agentRepository.create({
                        xiaozhiAccountId: account.id,
                        organizationId: account.organizationId,
                        ownerUserId: account.ownerUserId,
                        upstreamAgentId,
                        assignedUserId: null,
                    });
                binding.name = agent.agent_name?.trim() || `智能体 ${upstreamAgentId}`;
                binding.model = agent.llm_model || null;
                binding.voice = agent.tts_voice || null;
                binding.deviceCount = Number(agent.deviceCount || 0);
                binding.onlineDeviceCount = Number(agent.onlineDeviceCount || 0);
                binding.lastConnectedAt = agent.lastDevice?.last_connected_at
                    ? new Date(agent.lastDevice.last_connected_at)
                    : null;
                saved.push(await this.agentRepository.save(binding));
            }

            account.status = XiaozhiAccountStatus.ACTIVE;
            account.lastSyncAt = new Date();
            account.lastError = null;
            await this.accountRepository.save(account);
            return { synced: saved.length, agents: saved };
        } catch (error) {
            account.status =
                (error as { status?: number })?.status === 401
                    ? XiaozhiAccountStatus.AUTH_ERROR
                    : XiaozhiAccountStatus.SYNC_ERROR;
            account.lastError = error instanceof Error ? error.message.slice(0, 1000) : "同步失败";
            await this.accountRepository.save(account);
            throw error;
        }
    }

    async assignAgent(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        assignedUserId: string | null,
    ) {
        if (!organizationId) throw HttpErrorFactory.badRequest("个人空间设备不能分发给组织成员");
        await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            OrganizationPermission.ASSET_MANAGE,
        );
        if (assignedUserId) {
            await this.organizationService.assertAssignableMember(organizationId, assignedUserId);
        }
        const agent = await this.agentRepository.findOne({
            where: { id: agentId, organizationId },
        });
        if (!agent) throw HttpErrorFactory.notFound("方糖猫智能体不存在");
        agent.assignedUserId = assignedUserId || null;
        return this.agentRepository.save(agent);
    }

    /**
     * Resolve one agent binding inside the caller's current workspace.
     *
     * Students only ever reach agents distributed to them, so read paths stay
     * scoped without a second permission check. Anything that mutates upstream
     * state passes `requireManage` and is limited to asset managers.
     */
    private async resolveAgent(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        requireManage = false,
    ) {
        const access = await this.organizationService.requireWorkspace(
            userId,
            organizationId,
            organizationId && requireManage ? OrganizationPermission.ASSET_MANAGE : undefined,
        );

        const agent = await this.agentRepository.findOne({
            where:
                access.type === "organization"
                    ? { id: agentId, organizationId: access.organizationId as string }
                    : { id: agentId, organizationId: IsNull(), ownerUserId: userId },
        });
        if (!agent) throw HttpErrorFactory.notFound("方糖猫智能体不存在");

        if (
            access.type === "organization" &&
            !access.permissions.includes(OrganizationPermission.ASSET_READ) &&
            agent.assignedUserId !== userId
        ) {
            throw HttpErrorFactory.forbidden("该方糖猫没有分发给你");
        }

        const account = await this.accountRepository.findOne({
            where: { id: agent.xiaozhiAccountId },
        });
        if (!account) throw HttpErrorFactory.notFound("方糖猫所属的小智账号不存在");
        return { access, agent, account };
    }

    async listDevices(userId: string, organizationId: string | null | undefined, agentId: string) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId);
        const result = await this.request<UpstreamDevicePayload[]>(
            account,
            `/agents/${agent.upstreamAgentId}/devices`,
        );
        const devices = (result.data || []).map((device) => mapUpstreamDevice(device, agent.id));
        await this.refreshDeviceCounters(agent, devices);
        return devices;
    }

    async bindDevice(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        verificationCode: string,
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId, true);
        await this.request(account, `/agents/${agent.upstreamAgentId}/devices`, {
            method: "POST",
            body: { verificationCode: verificationCode.trim() },
        });
        return { success: true };
    }

    async updateDeviceAlias(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        input: { macAddress: string; alias: string },
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId, true);
        await this.request(account, `/agents/${agent.upstreamAgentId}/devices/update-alias`, {
            method: "POST",
            body: { macAddress: input.macAddress, alias: input.alias.trim() },
        });
        return { success: true };
    }

    async updateDeviceAutoUpdate(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        input: { macAddress: string; autoUpdate: boolean },
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId, true);
        await this.request(account, `/agents/${agent.upstreamAgentId}/devices/update-auto-update`, {
            method: "POST",
            body: { macAddress: input.macAddress, autoUpdate: input.autoUpdate },
        });
        return { success: true };
    }

    async unbindDevice(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        deviceId: number,
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId, true);
        await this.request(account, `/agents/${agent.upstreamAgentId}/devices/delete`, {
            method: "POST",
            body: { deviceId },
        });
        return { success: true };
    }

    /**
     * Load everything the agent editor needs in one round trip: the agent
     * config plus the voice, model, MCP tool and knowledge base enumerations
     * that the upstream console scopes to the agent's template.
     */
    async getAgentEditorData(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId);
        const detail = await this.request<{
            agent?: { agent_template_id?: number | null } & Record<string, unknown>;
        }>(account, `/agents/${agent.upstreamAgentId}`);
        const config = detail.data?.agent;
        if (!config) throw HttpErrorFactory.badGateway("小智智能体详情响应不完整");

        const templateId = config.agent_template_id;
        const suffix =
            typeof templateId === "number" && templateId > 0
                ? `?agent_template_id=${templateId}`
                : "";
        const [ttsResult, modelResult, mcpResult, knowledgeResult] = await Promise.all([
            this.request<{ languages?: string[]; tts_voices?: Record<string, unknown[]> }>(
                account,
                `/user/tts-list${suffix}`,
            ),
            this.request<{ modelList?: unknown[] }>(account, `/roles/model-list${suffix}`),
            this.request<unknown[]>(
                account,
                `/agents/common-mcp-tool/list?agentId=${agent.upstreamAgentId}`,
            ),
            this.request<{ list?: unknown[] }>(account, `/knowledge-bases/enum${suffix}`),
        ]);

        return {
            agentId: agent.id,
            name: agent.name,
            config,
            ttsList: {
                languages: ttsResult.data?.languages || [],
                ttsVoices: ttsResult.data?.tts_voices || {},
            },
            models: modelResult.data?.modelList || [],
            mcpTools: mcpResult.data || [],
            knowledgeBases: knowledgeResult.data?.list || [],
        };
    }

    /**
     * Read the full upstream config of one agent, for scene capture. Returns
     * the raw upstream agent object; callers pick the fields they persist.
     */
    async captureAgentConfig(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId, true);
        const detail = await this.request<{ agent?: Record<string, unknown> }>(
            account,
            `/agents/${agent.upstreamAgentId}`,
        );
        const config = detail.data?.agent;
        if (!config) throw HttpErrorFactory.badGateway("小智智能体详情响应不完整");
        return { agent, config };
    }

    async renameAgent(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        name: string,
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId, true);
        await this.request(account, "/agents/update-name", {
            method: "POST",
            body: { id: Number(agent.upstreamAgentId), name: name.trim() },
        });
        agent.name = name.trim();
        return this.agentRepository.save(agent);
    }

    async updateAgentConfig(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        config: Record<string, unknown>,
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId, true);
        await this.request(account, `/agents/${agent.upstreamAgentId}/config`, {
            method: "POST",
            body: config,
        });

        // Mirror the fields the agent list renders so the UI stays consistent
        // without waiting for a full account sync.
        const model = config.llm_model ?? config.model;
        const voice = config.tts_voice ?? config.voice;
        if (typeof model === "string") agent.model = model;
        if (typeof voice === "string") agent.voice = voice;
        return this.agentRepository.save(agent);
    }

    async listAgentChats(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        pageSize = 20,
    ) {
        const { agent, account } = await this.resolveAgent(userId, organizationId, agentId);
        const result = await this.request<{ list?: UpstreamChatPayload[] }>(
            account,
            `/chats/list?agentId=${agent.upstreamAgentId}&page=1&pageSize=${pageSize}`,
        );
        return (result.data?.list || []).map((chat) =>
            mapUpstreamChat(chat, agent.id, agent.name),
        );
    }

    async listChatMessages(
        userId: string,
        organizationId: string | null | undefined,
        agentId: string,
        chatId: number,
    ) {
        const { account } = await this.resolveAgent(userId, organizationId, agentId);
        const result = await this.request<{ list?: UpstreamChatMessagePayload[] }>(
            account,
            `/chats/messages?chatId=${chatId}&page=1&pageSize=100&includeTools=1&order=asc`,
        );
        return (result.data?.list || []).map((message) => mapUpstreamChatMessage(message, chatId));
    }

    /**
     * Keep the cached device counters aligned with what the console just read,
     * so the agent list does not drift until the next full account sync.
     */
    private async refreshDeviceCounters(agent: XiaozhiAgentBinding, devices: MappedDevice[]) {
        const summary = summarizeDevices(devices);
        // Keep the previously known timestamp when upstream reports no
        // connection history, so a transient empty read does not erase it.
        const lastConnectedAt = summary.lastConnectedAt ?? agent.lastConnectedAt;

        if (
            agent.deviceCount === summary.deviceCount &&
            agent.onlineDeviceCount === summary.onlineDeviceCount &&
            agent.lastConnectedAt?.getTime() === lastConnectedAt?.getTime()
        ) {
            return;
        }
        agent.deviceCount = summary.deviceCount;
        agent.onlineDeviceCount = summary.onlineDeviceCount;
        agent.lastConnectedAt = lastConnectedAt;
        await this.agentRepository.save(agent);
    }

    private async request<T>(
        account: XiaozhiAccount,
        path: string,
        init: { method?: string; body?: unknown } = {},
    ): Promise<UpstreamPayload<T>> {
        const headers: Record<string, string> = {
            Accept: "application/json",
            Authorization: `Bearer ${this.decrypt(account.accessTokenEncrypted)}`,
        };
        if (account.sessionCookieEncrypted) {
            headers.Cookie = this.decrypt(account.sessionCookieEncrypted);
        }
        if (init.body !== undefined) headers["Content-Type"] = "application/json";

        let response: Response;
        try {
            response = await fetch(`${this.baseUrl}${path}`, {
                method: init.method || "GET",
                headers,
                body: init.body === undefined ? undefined : JSON.stringify(init.body),
            });
        } catch {
            throw HttpErrorFactory.badGateway("无法连接小智服务");
        }
        const payload = (await this.parseResponse(response)) as UpstreamPayload<T>;
        const freshCookies = this.readSetCookies(response.headers);
        if (freshCookies) {
            const current = account.sessionCookieEncrypted
                ? this.decrypt(account.sessionCookieEncrypted)
                : "";
            account.sessionCookieEncrypted = this.encrypt(this.mergeCookies(current, freshCookies));
            await this.accountRepository.save(account);
        }
        if (!response.ok) {
            const error = HttpErrorFactory.thirdPartyError(
                payload.message || payload.error || `小智接口返回 ${response.status}`,
            ) as Error & { status?: number };
            error.status = response.status;
            throw error;
        }
        return payload;
    }

    private toPublicAccount(account: XiaozhiAccount) {
        const username = this.decrypt(account.usernameEncrypted);
        const usernameMasked =
            username.length <= 3
                ? `${username.slice(0, 1)}***`
                : `${username.slice(0, 2)}***${username.slice(-1)}`;
        return {
            id: account.id,
            organizationId: account.organizationId,
            ownerUserId: account.ownerUserId,
            label: account.label,
            usernameMasked,
            upstreamUserId: account.upstreamUserId,
            status: account.status,
            lastSyncAt: account.lastSyncAt,
            lastError: account.lastError,
            createdAt: account.createdAt,
        };
    }

    private cleanupChallenges() {
        const now = Date.now();
        for (const [id, challenge] of this.challenges.entries()) {
            if (challenge.expiresAt <= now) this.challenges.delete(id);
        }
    }

    private async parseResponse(response: Response): Promise<unknown> {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) return response.json();
        const text = await response.text();
        return { message: text || `上游接口返回 ${response.status}` };
    }

    private readSetCookies(headers: Headers) {
        const values =
            (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ||
            [headers.get("set-cookie") || ""];
        return values
            .flatMap((value) => value.split(/,(?=\s*[^;,]+=)/))
            .map((value) => value.split(";", 1)[0]?.trim())
            .filter(Boolean)
            .join("; ");
    }

    private mergeCookies(current: string, incoming: string) {
        const jar = new Map<string, string>();
        for (const cookie of `${current}; ${incoming}`.split(";")) {
            const trimmed = cookie.trim();
            const separator = trimmed.indexOf("=");
            if (separator <= 0) continue;
            jar.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
        }
        return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
    }

    private encrypt(value: string) {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
        const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
        return [iv, cipher.getAuthTag(), encrypted]
            .map((part) => part.toString("base64url"))
            .join(".");
    }

    private decrypt(value: string) {
        const [iv, tag, encrypted] = value.split(".");
        if (!iv || !tag || !encrypted) throw new Error("无效的加密凭据");
        const decipher = createDecipheriv(
            "aes-256-gcm",
            this.encryptionKey,
            Buffer.from(iv, "base64url"),
        );
        decipher.setAuthTag(Buffer.from(tag, "base64url"));
        return Buffer.concat([
            decipher.update(Buffer.from(encrypted, "base64url")),
            decipher.final(),
        ]).toString("utf8");
    }
}
