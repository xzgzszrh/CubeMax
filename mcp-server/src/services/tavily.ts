import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { BuildingAiMcpService } from "../types.js";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "";
const TAVILY_BASE_URL = process.env.TAVILY_BASE_URL ?? "https://api.tavily.com";

function getTavilyApiKey(): string {
    if (!TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY environment variable is not set");
    }
    return TAVILY_API_KEY;
}

async function tavilyPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const apiKey = getTavilyApiKey();
    const response = await fetch(`${TAVILY_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Tavily API error ${response.status}: ${text || response.statusText}`);
    }

    return response.json() as Promise<T>;
}

function parseStringArray(value: unknown): string[] | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.length > 0);
    if (typeof value === "string")
        return value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    return undefined;
}

// --- Search tool ---

interface TavilySearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
    raw_content?: string;
}

interface TavilySearchResponse {
    query: string;
    answer?: string;
    results: TavilySearchResult[];
    images?: Array<{ url: string; description?: string }>;
    response_time: number;
}

function formatSearchResults(data: TavilySearchResponse): CallToolResult {
    const lines: string[] = [];

    if (data.answer) {
        lines.push(`## Answer\n\n${data.answer}\n`);
    }

    lines.push(`## Results (${data.results.length})\n`);

    for (const result of data.results) {
        lines.push(`### ${result.title}\n`);
        lines.push(`**URL:** ${result.url}`);
        lines.push(`**Score:** ${result.score.toFixed(3)}\n`);
        lines.push(`${result.content}\n`);
    }

    if (data.images && data.images.length > 0) {
        lines.push(`## Images (${data.images.length})\n`);
        for (const img of data.images) {
            lines.push(`- ${img.url}${img.description ? ` — ${img.description}` : ""}`);
        }
    }

    lines.push(`\n_Response time: ${data.response_time.toFixed(2)}s_`);

    return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: {
            query: data.query,
            answer: data.answer ?? null,
            results: data.results,
            images: data.images ?? [],
            responseTime: data.response_time,
        },
    };
}

// --- Extract tool ---

interface TavilyExtractResult {
    url: string;
    raw_content: string;
    images?: string[];
}

interface TavilyExtractResponse {
    results: TavilyExtractResult[];
    failed_results?: Array<{ url: string; error: string }>;
    response_time: number;
}

function formatExtractResults(data: TavilyExtractResponse): CallToolResult {
    const lines: string[] = [];

    lines.push(`## Extracted Content (${data.results.length} sources)\n`);

    for (const result of data.results) {
        lines.push(`### ${result.url}\n`);
        const content =
            result.raw_content.length > 2000
                ? `${result.raw_content.slice(0, 2000)}...\n\n_(truncated, full content in structuredContent)_`
                : result.raw_content;
        lines.push(`${content}\n`);
    }

    if (data.failed_results && data.failed_results.length > 0) {
        lines.push(`## Failed (${data.failed_results.length})\n`);
        for (const fail of data.failed_results) {
            lines.push(`- ${fail.url}: ${fail.error}`);
        }
    }

    lines.push(`\n_Response time: ${data.response_time.toFixed(2)}s_`);

    return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: {
            results: data.results,
            failedResults: data.failed_results ?? [],
            responseTime: data.response_time,
        },
    };
}

// --- Service definition ---

export const tavilyService: BuildingAiMcpService = {
    key: "tavily",
    name: "Tavily Search",
    description: "Web search and content extraction powered by Tavily API.",
    tools: [
        {
            name: "tavily_search",
            title: "Web Search",
            description:
                "Search the web using Tavily. Returns ranked results with snippets, optional AI-generated answer, and images.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "The search query to execute." },
                    search_depth: {
                        type: "string",
                        description:
                            "Controls latency vs relevance. 'basic' (default), 'advanced' (more relevant, 2 credits), 'fast', 'ultra-fast'.",
                    },
                    max_results: {
                        type: "number",
                        description: "Maximum number of results (1-20, default 5).",
                    },
                    topic: {
                        type: "string",
                        description: "Search category: 'general' (default), 'news', 'finance'.",
                    },
                    time_range: {
                        type: "string",
                        description: "Filter by time: 'day', 'week', 'month', 'year'.",
                    },
                    include_answer: {
                        type: "boolean",
                        description: "Include an AI-generated answer summary (default false).",
                    },
                    include_raw_content: {
                        type: "boolean",
                        description: "Include full page content for each result (default false).",
                    },
                    include_images: {
                        type: "boolean",
                        description: "Include related images (default false).",
                    },
                    include_domains: {
                        type: "string",
                        description: "Comma-separated domains to include.",
                    },
                    exclude_domains: {
                        type: "string",
                        description: "Comma-separated domains to exclude.",
                    },
                },
                required: ["query"],
                additionalProperties: false,
            },
            async execute(args): Promise<CallToolResult> {
                const query = args.query;
                if (typeof query !== "string" || !query.trim()) {
                    throw new Error('"query" is required and must be a non-empty string');
                }

                const body: Record<string, unknown> = { query: query.trim() };

                if (args.search_depth) body.search_depth = args.search_depth;
                if (args.max_results)
                    body.max_results = Math.min(20, Math.max(1, Number(args.max_results)));
                if (args.topic) body.topic = args.topic;
                if (args.time_range) body.time_range = args.time_range;
                if (args.include_answer) body.include_answer = true;
                if (args.include_raw_content) body.include_raw_content = "markdown";
                if (args.include_images) body.include_images = true;

                const includeDomains = parseStringArray(args.include_domains);
                if (includeDomains?.length) body.include_domains = includeDomains;

                const excludeDomains = parseStringArray(args.exclude_domains);
                if (excludeDomains?.length) body.exclude_domains = excludeDomains;

                const data = await tavilyPost<TavilySearchResponse>("/search", body);
                return formatSearchResults(data);
            },
        },
        {
            name: "tavily_extract",
            title: "Extract Content",
            description: "Extract and clean content from one or more URLs using Tavily.",
            inputSchema: {
                type: "object",
                properties: {
                    urls: {
                        type: "string",
                        description: "One or more URLs to extract content from, comma-separated.",
                    },
                    extract_depth: {
                        type: "string",
                        description:
                            "Extraction depth: 'basic' (default) or 'advanced' (more content, higher latency).",
                    },
                    include_images: {
                        type: "boolean",
                        description: "Include extracted images (default false).",
                    },
                    format: {
                        type: "string",
                        description: "Output format: 'markdown' (default) or 'text'.",
                    },
                },
                required: ["urls"],
                additionalProperties: false,
            },
            async execute(args): Promise<CallToolResult> {
                const urlsRaw = args.urls;
                if (!urlsRaw) {
                    throw new Error('"urls" is required');
                }

                const urls = parseStringArray(urlsRaw);
                if (!urls || urls.length === 0) {
                    throw new Error('"urls" must contain at least one valid URL');
                }
                if (urls.length > 20) {
                    throw new Error('"urls" cannot exceed 20 URLs');
                }

                const body: Record<string, unknown> = { urls };

                if (args.extract_depth) body.extract_depth = args.extract_depth;
                if (args.include_images) body.include_images = true;
                if (args.format) body.format = args.format;

                const data = await tavilyPost<TavilyExtractResponse>("/extract", body);
                return formatExtractResults(data);
            },
        },
    ],
};
