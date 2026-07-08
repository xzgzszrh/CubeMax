import { calculatorService } from "./services/calculator.js";
import { embeddedService } from "./services/embedded.js";
import { tavilyService } from "./services/tavily.js";
import { textService } from "./services/text.js";
import type { BuildingAiMcpService, McpServiceCatalogItem } from "./types.js";

const services: BuildingAiMcpService[] = [
    calculatorService,
    textService,
    embeddedService,
    ...(process.env.TAVILY_API_KEY ? [tavilyService] : []),
];
const servicesByKey = new Map(services.map((service) => [service.key, service] as const));

export function listMcpServices(): BuildingAiMcpService[] {
    return services;
}

export function getMcpService(key: string): BuildingAiMcpService | undefined {
    return servicesByKey.get(key);
}

export function getMcpServiceKeys(): string[] {
    return services.map((service) => service.key);
}

export function createMcpCatalog(baseUrl: string): McpServiceCatalogItem[] {
    return services.map((service) => ({
        key: service.key,
        name: service.name,
        description: service.description,
        url: `${baseUrl}/mcp/${service.key}`,
        tools: service.tools.map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
        })),
    }));
}
