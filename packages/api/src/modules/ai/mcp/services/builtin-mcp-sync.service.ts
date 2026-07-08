import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiMcpServer, McpCommunicationType, McpServerType } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";

import { AiMcpServerService } from "./ai-mcp-server.service";

const BUILTIN_MCP_PROVIDER_NAME = "BuildingAI MCP Server";
const DEFAULT_DISCOVERY_TIMEOUT_MS = 10000;

type BuiltinMcpCatalogItem = {
    key: string;
    name: string;
    description?: string;
    url?: string;
};

@Injectable()
export class BuiltinMcpSyncService implements OnApplicationBootstrap {
    private readonly logger = new Logger(BuiltinMcpSyncService.name);

    constructor(
        @InjectRepository(AiMcpServer)
        private readonly aiMcpServerRepository: Repository<AiMcpServer>,
        private readonly aiMcpServerService: AiMcpServerService,
    ) {}

    async onApplicationBootstrap() {
        const hubUrls = this.getConfiguredHubUrls();
        if (hubUrls.length === 0) {
            return;
        }

        for (const hubUrl of hubUrls) {
            try {
                await this.syncHub(hubUrl);
            } catch (error) {
                this.logger.warn(
                    `Built-in MCP sync failed for ${hubUrl}: ${this.getErrorMessage(error)}`,
                );
            }
        }
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

    private async syncHub(hubUrl: string) {
        const catalog = await this.fetchCatalog(hubUrl);
        if (catalog.length === 0) {
            this.logger.warn(`Built-in MCP catalog is empty: ${hubUrl}`);
            return;
        }

        let synced = 0;
        for (const [index, item] of catalog.entries()) {
            try {
                const server = await this.upsertCatalogItem(hubUrl, item, index);
                await this.aiMcpServerService.checkConnectionAndUpdateTools(server.id);
                synced += 1;
            } catch (error) {
                this.logger.warn(
                    `Built-in MCP service sync failed (${hubUrl}/${item.key}): ${this.getErrorMessage(
                        error,
                    )}`,
                );
            }
        }

        this.logger.log(`Built-in MCP sync completed: ${synced}/${catalog.length} from ${hubUrl}`);
    }

    private async fetchCatalog(hubUrl: string): Promise<BuiltinMcpCatalogItem[]> {
        const catalogUrl = new URL("/catalog", `${hubUrl}/`).toString();
        const timeoutMs = this.getDiscoveryTimeoutMs();
        const abortController = new AbortController();
        const timer = setTimeout(() => abortController.abort(), timeoutMs);

        try {
            const response = await fetch(catalogUrl, {
                signal: abortController.signal,
                headers: {
                    accept: "application/json",
                },
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

        return {
            key,
            name,
            description,
            url,
        };
    }

    private async upsertCatalogItem(
        hubUrl: string,
        item: BuiltinMcpCatalogItem,
        index: number,
    ): Promise<AiMcpServer> {
        const existing = await this.aiMcpServerRepository.findOne({
            where: {
                type: McpServerType.SYSTEM,
                url: item.url,
            },
        });

        const patch: Partial<AiMcpServer> = {
            name: item.name,
            alias: item.name,
            description: item.description,
            type: McpServerType.SYSTEM,
            url: item.url,
            communicationType: McpCommunicationType.STREAMABLEHTTP,
            headers: {},
            providerName: BUILTIN_MCP_PROVIDER_NAME,
            providerUrl: hubUrl.slice(0, 100),
            sortOrder: index,
        };

        if (existing) {
            await this.aiMcpServerRepository.update(existing.id, patch);
            return (await this.aiMcpServerRepository.findOneByOrFail({ id: existing.id }))!;
        }

        return await this.aiMcpServerRepository.save({
            ...patch,
            isDisabled: false,
            icon: "",
            connectable: false,
            connectError: "",
        });
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
