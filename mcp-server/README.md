# ansar-aeo-mcp

A standalone [Model Context Protocol](https://modelcontextprotocol.io) server that exposes read-only
AnsarAEO workspace tools to any MCP-compatible client (Claude Code, Claude Desktop, etc.).

It is intentionally **outside** the Next.js app (`mcp-server/` is excluded from the root `tsconfig.json`
and is never bundled into `next build`). It talks to your Supabase project directly with the
service-role key, so it has the same trust level as the app's cron/report jobs — keep its key secret.

## Tools

| Tool | Description |
|------|-------------|
| `aeo_list_brands` | List every brand (id, name, domain, org_id). |
| `aeo_visibility_summary` | Compute the recent brand-mention rate across visibility runs for a brand. |
| `aeo_list_competitors` | List confirmed competitors for a brand. |

## Setup

```bash
cd mcp-server
npm install
npm run build          # emits dist/index.js
node dist/index.js     # runs over stdio
```

## Register with Claude Code

The repo root `.mcp.json` already registers it:

```json
{
  "mcpServers": {
    "ansar-aeo": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  }
}
```

Add the Supabase env vars to the server's environment (e.g. in your shell profile or the MCP client's
env config):

```bash
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
```

> Note: the service-role key bypasses RLS — only run this server in trusted environments.
