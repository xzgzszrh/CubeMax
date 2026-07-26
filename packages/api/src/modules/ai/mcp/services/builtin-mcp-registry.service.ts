import { createHash } from "node:crypto";

import { createMcpClient, type McpClient } from "@buildingai/ai-sdk";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    AiMcpServer,
    AiMcpTool,
    McpCommunicationType,
    McpServerType,
} from "@buildingai/db/entities";
import { IsNull, Repository } from "@buildingai/db/typeorm";
import { getLocalMcpHubBaseUrl } from "@modules/mcp-hub/mcp-hub.constants";
import { McpHubService } from "@modules/mcp-hub/services/mcp-hub.service";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";

export const BUILTIN_MCP_PROVIDER_NAME = "CubeMax MCP Server";
export const BUILTIN_MCP_ID_PREFIX = "builtin_";

const DEFAULT_DISCOVERY_TIMEOUT_MS = 10000;

type BuiltinMcpCatalogItem = {
    key: string;
    name: string;
    description: string;
    url: string;
};

/**
 * 内置MCP工具（内存态，不落库）
 */
export type BuiltinMcpTool = {
    id: string;
    name: string;
    title?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    mcpServerId: string;
    createdAt: string;
    updatedAt: string;
};

/**
 * 内置MCP服务（内存态，不落库）
 *
 * 由环境变量配置的 MCP Hub 通过 /catalog 动态嗅探而来。
 * 这些服务只读：控制台不允许删除、编辑、启停。
 */
export type BuiltinMcpServer = {
    id: string;
    key: string;
    name: string;
    alias?: string;
    description?: string;
    icon: string;
    type: McpServerType;
    url: string;
    communicationType: McpCommunicationType;
    headers: Record<string, string>;
    providerIcon?: string;
    providerName: string;
    providerUrl: string;
    sortOrder: number;
    connectable: boolean;
    connectError: string;
    isDisabled: boolean;
    creatorId?: string;
    isBuiltin: true;
    tools: BuiltinMcpTool[];
    createdAt: string;
    updatedAt: string;
};

/**
 * 内置MCP注册表服务
 *
 * 负责在后端启动时从配置的 MCP Hub 嗅探服务，并将其保存在内存中动态提供，
 * 而不是写入数据库。这样这些服务无法被误删，也始终与 Hub 保持同步。
 */
@Injectable()
export class BuiltinMcpRegistryService implements OnApplicationBootstrap {
    private readonly logger = new Logger(BuiltinMcpRegistryService.name);

    /** 内存态的内置MCP服务，key 为服务ID */
    private servers = new Map<string, BuiltinMcpServer>();

    constructor(
        @InjectRepository(AiMcpServer)
        private readonly aiMcpServerRepository: Repository<AiMcpServer>,
        @InjectRepository(AiMcpTool)
        private readonly aiMcpToolRepository: Repository<AiMcpTool>,
        private readonly mcpHubService: McpHubService,
    ) {}

    async onApplicationBootstrap() {
        // 清理历史遗留：早期版本会把嗅探到的MCP写进数据库，这里一次性清除
        await this.cleanupLegacyPersistedServers();

        await this.refresh();
    }

    /**
     * 判断某个ID是否为内置（动态）MCP服务ID
     */
    isBuiltinId(id: string | undefined | null): boolean {
        return typeof id === "string" && id.startsWith(BUILTIN_MCP_ID_PREFIX);
    }

    /**
     * 列出全部内置MCP服务（内存态）
     */
    listServers(): BuiltinMcpServer[] {
        return Array.from(this.servers.values()).sort((a, b) => a.sortOrder - b.sortOrder);
    }

    /**
     * 根据ID获取单个内置MCP服务
     */
    getServer(id: string): BuiltinMcpServer | undefined {
        return this.servers.get(id);
    }

    /**
     * 根据 catalog key 获取内置MCP服务
     */
    getServerByKey(key: string): BuiltinMcpServer | undefined {
        return this.listServers().find((server) => server.key === key);
    }

    /**
     * 获取某个内置MCP服务下的工具
     */
    getTool(serverId: string, toolName: string): BuiltinMcpTool | undefined {
        return this.servers.get(serverId)?.tools.find((tool) => tool.name === toolName);
    }

    /**
     * 刷新内存注册表
     *
     * 本进程内置 hub（原独立 mcp-server，已合并进主后端）走进程内直读，
     * 不发 HTTP——注册表在应用 bootstrap 阶段刷新，此时 HTTP 端口尚未监听，
     * 自嗅探请求必然失败；直读还省去回环开销。BUILTIN_MCP_SERVER_URLS
     * 仍可配置额外的外部 hub，嗅探结果与本地服务合并。
     */
    async refresh(): Promise<void> {
        const next = new Map<string, BuiltinMcpServer>();

        const localServers = this.buildLocalServers();
        for (const server of localServers) {
            next.set(server.id, server);
        }
        const localUrls = new Set(localServers.map((server) => server.url));

        let sortOrder = localServers.length;
        for (const hubUrl of this.getConfiguredHubUrls()) {
            try {
                const catalog = await this.fetchCatalog(hubUrl);
                for (const item of catalog) {
                    // 外部 hub 配置成指向自身时会与本地服务重复，跳过
                    if (localUrls.has(item.url)) {
                        continue;
                    }
                    const server = await this.buildServer(hubUrl, item, sortOrder);
                    next.set(server.id, server);
                    sortOrder += 1;
                }
            } catch (error) {
                this.logger.warn(
                    `Built-in MCP discovery failed for ${hubUrl}: ${this.getErrorMessage(error)}`,
                );
            }
        }

        this.servers = next;
        this.logger.log(`Built-in MCP registry refreshed: ${next.size} service(s)`);
    }

    /**
     * 从进程内置 hub 直读服务与工具，构建内存态服务对象。
     *
     * URL 指向本进程的回环 MCP 端点（/api/mcp-hub/mcp/:serviceKey），
     * 供聊天运行时、工作流与小智网关等消费方按 URL 调用；
     * ID 由服务 key 派生（而非 URL 哈希），端口或前缀变化时保持稳定。
     */
    private buildLocalServers(): BuiltinMcpServer[] {
        const baseUrl = getLocalMcpHubBaseUrl();
        const now = new Date().toISOString();

        return this.mcpHubService.listServices().map((service, index) => {
            const id = this.buildLocalServerId(service.key);
            return {
                id,
                key: service.key,
                name: service.name,
                alias: service.name,
                description: service.description,
                icon: "",
                type: McpServerType.SYSTEM,
                url: `${baseUrl}/mcp/${service.key}`,
                communicationType: McpCommunicationType.STREAMABLEHTTP,
                headers: {},
                providerName: BUILTIN_MCP_PROVIDER_NAME,
                providerUrl: baseUrl.slice(0, 100),
                sortOrder: index,
                connectable: true,
                connectError: "",
                isDisabled: false,
                isBuiltin: true as const,
                tools: service.tools.map((tool) => ({
                    id: `${id}:${tool.name}`,
                    name: tool.name,
                    title: tool.title,
                    description: tool.description,
                    inputSchema: tool.inputSchema as Record<string, unknown>,
                    mcpServerId: id,
                    createdAt: now,
                    updatedAt: now,
                })),
                createdAt: now,
                updatedAt: now,
            };
        });
    }

    /**
     * 连接单个内置MCP服务并拉取工具，返回内存态服务对象
     */
    private async buildServer(
        hubUrl: string,
        item: BuiltinMcpCatalogItem,
        index: number,
    ): Promise<BuiltinMcpServer> {
        const id = this.buildServerId(item.url);
        const now = new Date().toISOString();

        const base: BuiltinMcpServer = {
            id,
            key: item.key,
            name: item.name,
            alias: item.name,
            description: item.description,
            icon: "",
            type: McpServerType.SYSTEM,
            url: item.url,
            communicationType: McpCommunicationType.STREAMABLEHTTP,
            headers: {},
            providerName: BUILTIN_MCP_PROVIDER_NAME,
            providerUrl: hubUrl.slice(0, 100),
            sortOrder: index,
            connectable: false,
            connectError: "",
            isDisabled: false,
            isBuiltin: true,
            tools: [],
            createdAt: now,
            updatedAt: now,
        };

        let client: McpClient | null = null;
        try {
            client = await createMcpClient({
                transport: {
                    type: "http",
                    url: item.url,
                },
                name: item.name,
            });

            const tools = await client.listTools();
            base.connectable = true;
            base.tools = tools.map((tool) => ({
                id: `${id}:${tool.name}`,
                name: tool.name,
                title: tool.title,
                description: tool.description,
                inputSchema: tool.inputSchema,
                mcpServerId: id,
                createdAt: now,
                updatedAt: now,
            }));
        } catch (error) {
            base.connectable = false;
            base.connectError = this.getErrorMessage(error);
            this.logger.warn(`Built-in MCP connect failed (${item.url}): ${base.connectError}`);
        } finally {
            if (client) {
                await client.close().catch(() => undefined);
            }
        }

        return base;
    }

    /**
     * 清理早期版本写进数据库的内置MCP服务
     */
    private async cleanupLegacyPersistedServers(): Promise<void> {
        const legacy = await this.aiMcpServerRepository.find({
            where: {
                type: McpServerType.SYSTEM,
                providerName: BUILTIN_MCP_PROVIDER_NAME,
                creatorId: IsNull(),
            },
        });

        if (legacy.length === 0) {
            return;
        }

        const ids = legacy.map((server) => server.id);
        // 工具表通过 mcpServerId 关联，显式清理避免残留
        for (const id of ids) {
            await this.aiMcpToolRepository.delete({ mcpServerId: id }).catch(() => undefined);
        }
        await this.aiMcpServerRepository.delete(ids);

        this.logger.log(`Removed ${legacy.length} legacy persisted built-in MCP server(s)`);
    }

    private buildServerId(url: string): string {
        const hash = createHash("sha1").update(url).digest("hex").slice(0, 24);
        return `${BUILTIN_MCP_ID_PREFIX}${hash}`;
    }

    /**
     * 进程内置服务的ID由服务 key 派生，与部署端口/前缀无关
     */
    private buildLocalServerId(serviceKey: string): string {
        const hash = createHash("sha1").update(`local:${serviceKey}`).digest("hex").slice(0, 24);
        return `${BUILTIN_MCP_ID_PREFIX}${hash}`;
    }

    private getConfiguredHubUrls(): string[] {
        const raw = process.env.BUILTIN_MCP_SERVER_URLS || process.env.BUILTIN_MCP_SERVER_URL || "";

        return Array.from(
            new Set(
                raw
                    .split(/[\n,;]/)
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item) => item.replace(/\/+$/, "")),
            ),
        );
    }

    private async fetchCatalog(hubUrl: string): Promise<BuiltinMcpCatalogItem[]> {
        const catalogUrl = new URL("/catalog", `${hubUrl}/`).toString();
        const timeoutMs = this.getDiscoveryTimeoutMs();
        const abortController = new AbortController();
        const timer = setTimeout(() => abortController.abort(), timeoutMs);

        try {
            const response = await fetch(catalogUrl, {
                signal: abortController.signal,
                headers: { accept: "application/json" },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            const body: unknown = await response.json();
            if (!Array.isArray(body)) {
                throw new Error("catalog response must be an array");
            }

            return body.map((item, index) => this.normalizeCatalogItem(item, hubUrl, index));
        } finally {
            clearTimeout(timer);
        }
    }

    private normalizeCatalogItem(
        value: unknown,
        hubUrl: string,
        index: number,
    ): BuiltinMcpCatalogItem {
        if (!this.isRecord(value)) {
            throw new Error(`catalog item at index ${index} must be an object`);
        }

        const key = this.readNonEmptyString(value.key, `catalog[${index}].key`);
        const name = this.readNonEmptyString(value.name, `catalog[${index}].name`);
        const description =
            typeof value.description === "string" ? value.description : "Built-in MCP service";
        const rawUrl = typeof value.url === "string" && value.url ? value.url : `/mcp/${key}`;
        const url = new URL(rawUrl, `${hubUrl}/`).toString();

        return { key, name, description, url };
    }

    private getDiscoveryTimeoutMs(): number {
        const value = Number.parseInt(process.env.BUILTIN_MCP_DISCOVERY_TIMEOUT_MS || "", 10);
        if (Number.isFinite(value) && value > 0) {
            return value;
        }

        return DEFAULT_DISCOVERY_TIMEOUT_MS;
    }

    private readNonEmptyString(value: unknown, fieldName: string): string {
        if (typeof value !== "string" || !value.trim()) {
            throw new Error(`${fieldName} must be a non-empty string`);
        }

        return value.trim();
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return !!value && typeof value === "object" && !Array.isArray(value);
    }

    private getErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
