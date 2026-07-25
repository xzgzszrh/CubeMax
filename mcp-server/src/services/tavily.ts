import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { BuildingAiMcpService } from "../types.js";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? "";
const TAVILY_BASE_URL = process.env.TAVILY_BASE_URL ?? "https://api.tavily.com";

function getTavilyApiKey(): string {
    if (!TAVILY_API_KEY) {
        throw new Error("未配置 TAVILY_API_KEY 环境变量");
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
        throw new Error(`Tavily API 请求失败（${response.status}）：${text || response.statusText}`);
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
        lines.push(`## 答案\n\n${data.answer}\n`);
    }

    lines.push(`## 搜索结果（${data.results.length} 条）\n`);

    for (const result of data.results) {
        lines.push(`### ${result.title}\n`);
        lines.push(`**URL:** ${result.url}`);
        lines.push(`**相关度：** ${result.score.toFixed(3)}\n`);
        lines.push(`${result.content}\n`);
    }

    if (data.images && data.images.length > 0) {
        lines.push(`## 相关图片（${data.images.length} 张）\n`);
        for (const img of data.images) {
            lines.push(`- ${img.url}${img.description ? ` — ${img.description}` : ""}`);
        }
    }

    lines.push(`\n_响应时间：${data.response_time.toFixed(2)} 秒_`);

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

    lines.push(`## 提取内容（${data.results.length} 个来源）\n`);

    for (const result of data.results) {
        lines.push(`### ${result.url}\n`);
        const content =
            result.raw_content.length > 2000
                ? `${result.raw_content.slice(0, 2000)}...\n\n_（内容已截断，完整内容请查看 structuredContent）_`
                : result.raw_content;
        lines.push(`${content}\n`);
    }

    if (data.failed_results && data.failed_results.length > 0) {
        lines.push(`## 提取失败（${data.failed_results.length} 个）\n`);
        for (const fail of data.failed_results) {
            lines.push(`- ${fail.url}: ${fail.error}`);
        }
    }

    lines.push(`\n_响应时间：${data.response_time.toFixed(2)} 秒_`);

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
    name: "Tavily 搜索",
    description: "由 Tavily API 提供的网页搜索与内容提取服务。",
    tools: [
        {
            name: "tavily_search",
            title: "网页搜索",
            description: "使用 Tavily 搜索网页，返回按相关度排序的摘要、可选的 AI 答案和图片。",
            inputSchema: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        title: "搜索关键词",
                        description: "要执行的搜索查询。",
                    },
                    search_depth: {
                        type: "string",
                        title: "搜索深度",
                        enum: ["basic", "advanced", "fast", "ultra-fast"],
                        default: "basic",
                        description: "控制搜索速度与相关度，默认为基础模式。高级模式相关度更高，但会消耗 2 个积分。",
                    },
                    max_results: {
                        type: "number",
                        title: "最大结果数",
                        description: "返回结果的最大数量，范围为 1 到 20，默认为 5。",
                    },
                    topic: {
                        type: "string",
                        title: "搜索主题",
                        enum: ["general", "news", "finance"],
                        default: "general",
                        description: "搜索内容的主题分类，默认为通用。",
                    },
                    time_range: {
                        type: "string",
                        title: "时间范围",
                        enum: ["day", "week", "month", "year"],
                        description: "按最近一天、一周、一个月或一年筛选结果。",
                    },
                    include_answer: {
                        type: "boolean",
                        title: "生成答案",
                        description: "是否返回由 AI 生成的答案摘要，默认不返回。",
                    },
                    include_raw_content: {
                        type: "boolean",
                        title: "返回原始内容",
                        description: "是否返回每条结果的完整网页内容，默认不返回。",
                    },
                    include_images: {
                        type: "boolean",
                        title: "返回相关图片",
                        description: "是否返回相关图片，默认不返回。",
                    },
                    include_domains: {
                        type: "string",
                        title: "包含域名",
                        description: "仅搜索指定域名，多个域名请使用英文逗号分隔。",
                    },
                    exclude_domains: {
                        type: "string",
                        title: "排除域名",
                        description: "排除指定域名，多个域名请使用英文逗号分隔。",
                    },
                },
                required: ["query"],
                additionalProperties: false,
            },
            async execute(args): Promise<CallToolResult> {
                const query = args.query;
                if (typeof query !== "string" || !query.trim()) {
                    throw new Error('“搜索关键词”必填，且不能为空');
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
            title: "提取网页内容",
            description: "使用 Tavily 从一个或多个网址中提取并清理网页内容。",
            inputSchema: {
                type: "object",
                properties: {
                    urls: {
                        type: "string",
                        title: "网页地址",
                        description: "要提取内容的一个或多个网址，多个网址请使用英文逗号分隔。",
                    },
                    extract_depth: {
                        type: "string",
                        title: "提取深度",
                        enum: ["basic", "advanced"],
                        default: "basic",
                        description: "内容提取深度。高级模式可提取更多内容，但耗时更长。",
                    },
                    include_images: {
                        type: "boolean",
                        title: "返回图片",
                        description: "是否返回提取到的图片，默认不返回。",
                    },
                    format: {
                        type: "string",
                        title: "输出格式",
                        enum: ["markdown", "text"],
                        default: "markdown",
                        description: "提取内容的输出格式，默认为 Markdown。",
                    },
                },
                required: ["urls"],
                additionalProperties: false,
            },
            async execute(args): Promise<CallToolResult> {
                const urlsRaw = args.urls;
                if (!urlsRaw) {
                    throw new Error('“网页地址”必填');
                }

                const urls = parseStringArray(urlsRaw);
                if (!urls || urls.length === 0) {
                    throw new Error('“网页地址”至少需要包含一个有效网址');
                }
                if (urls.length > 20) {
                    throw new Error('“网页地址”最多支持 20 个网址');
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
