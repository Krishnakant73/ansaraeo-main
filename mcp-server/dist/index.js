import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
const server = new McpServer({ name: "ansar-aeo", version: "0.1.0" });
// Lazily construct a service-role Supabase client. We only build it when a tool
// is actually called, so the server starts even if env vars are absent (it will
// return a clear error from the tool instead of crashing at boot).
function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the MCP server environment.");
    }
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
server.tool("aeo_list_brands", "List every brand in the AnsarAEO workspace (id, name, domain, org_id).", {}, async () => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("brands")
        .select("id, name, domain, org_id")
        .order("created_at", { ascending: false });
    if (error)
        throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }] };
});
server.tool("aeo_visibility_summary", "Compute the recent brand-mention rate across all visibility runs for a brand.", { brandId: z.string().describe("Brand UUID") }, async ({ brandId }) => {
    const supabase = getSupabase();
    const { data: prompts, error: pErr } = await supabase
        .from("prompts")
        .select("id")
        .eq("brand_id", brandId);
    if (pErr)
        throw new Error(pErr.message);
    const ids = (prompts ?? []).map((p) => p.id);
    if (ids.length === 0) {
        return { content: [{ type: "text", text: "No prompts tracked for this brand." }] };
    }
    const { data: runs, error: rErr } = await supabase
        .from("visibility_runs")
        .select("brand_mentioned")
        .in("prompt_id", ids);
    if (rErr)
        throw new Error(rErr.message);
    const all = runs ?? [];
    const mentioned = all.filter((r) => r.brand_mentioned).length;
    const rate = all.length ? Math.round((mentioned / all.length) * 100) : 0;
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({ totalRuns: all.length, mentionRatePct: rate }, null, 2),
            },
        ],
    };
});
server.tool("aeo_list_competitors", "List confirmed competitors for a brand.", { brandId: z.string().describe("Brand UUID") }, async ({ brandId }) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("competitors")
        .select("id, name, domain, confirmed")
        .eq("brand_id", brandId)
        .eq("confirmed", true)
        .order("created_at", { ascending: false });
    if (error)
        throw new Error(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }] };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("ansar-aeo MCP server running on stdio");
}
main().catch((err) => {
    console.error("ansar-aeo MCP server fatal:", err);
    process.exit(1);
});
