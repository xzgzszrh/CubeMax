/** 外部 MCP 工具的中文展示名称和说明。 */

const TAVILY_TOOL_COPY: Record<string, { title: string; description: string }> = {
  tavily_search: {
    title: "网页搜索",
    description:
      "在网上检索最新信息，适用于新闻、事实，或超出模型知识截止时间的数据。返回摘要片段和来源网址。",
  },
  tavily_extract: {
    title: "提取网页内容",
    description: "从指定网址提取页面正文，可输出 Markdown 或纯文本。",
  },
  tavily_crawl: {
    title: "网站抓取",
    description: "从起始网址开始抓取网站，可配置抓取深度和广度，提取多页内容。",
  },
  tavily_map: {
    title: "网站结构图",
    description: "梳理网站结构，从起始网址出发列出发现的页面地址。",
  },
  tavily_research: {
    title: "综合研究",
    description:
      "围绕一个主题或问题做综合调研，汇总网页、文档等多种来源后给出详细结论。每分钟最多 20 次请求。",
  },
};

export function localizeMcpTool(tool: {
  name: string;
  title?: string | null;
  description?: string | null;
}): { title: string; description: string } {
  const copy = TAVILY_TOOL_COPY[tool.name];
  if (copy) return copy;
  return {
    title: tool.title?.trim() || tool.name,
    description: tool.description?.trim() || "",
  };
}
