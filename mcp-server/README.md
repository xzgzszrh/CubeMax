# BuildingAI MCP Server

First-party MCP server hub for BuildingAI.

One process exposes multiple MCP servers under different paths:

```text
http://127.0.0.1:3334/mcp/calculator
http://127.0.0.1:3334/mcp/text
http://127.0.0.1:3334/mcp/embedded
```

## Environment Variables

```bash
# Required for Tavily MCP service (search/extract)
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxx

# Optional
HOST=127.0.0.1
PORT=3334
```

If `TAVILY_API_KEY` is not set, the Tavily service will not appear in `/catalog` and won't be
registered.

## Start

```bash
pnpm --filter @buildingai/mcp-server build
TAVILY_API_KEY=tvly-xxx pnpm --filter @buildingai/mcp-server start
```

Use a different host or port:

```bash
HOST=127.0.0.1 PORT=3335 pnpm --filter @buildingai/mcp-server start
```

## BuildingAI MCP Config

Create one MCP entry per service in `/console/mcp`.

```text
Name: Calculator
URL: http://127.0.0.1:3334/mcp/calculator
Communication type: Streamable HTTP
Headers: empty
```

```text
Name: Text
URL: http://127.0.0.1:3334/mcp/text
Communication type: Streamable HTTP
Headers: empty
```

```text
Name: Embedded Device Blocks
URL: http://127.0.0.1:3334/mcp/embedded
Communication type: Streamable HTTP
Headers: empty
```

```text
Name: Tavily (requires TAVILY_API_KEY)
URL: http://127.0.0.1:3334/mcp/tavily
Communication type: Streamable HTTP
Headers: empty
```

## Catalog

```text
GET http://127.0.0.1:3334/health
GET http://127.0.0.1:3334/catalog
GET http://127.0.0.1:3334/catalog/calculator
```
