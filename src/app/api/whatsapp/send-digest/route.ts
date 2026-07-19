import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTemplateMessage } from "@/lib/whatsapp";

// ============================================================
// GET /api/whatsapp/send-digest
//
// Sends a "Top opportunities" WhatsApp digest to every organization that
// has a verified WhatsApp number connected. Protected by CRON_SECRET,
// same pattern as /api/cron/nightly-runs.
//
// REQUIRES a pre-approved WhatsApp message template named
// "visibility_digest" with a body like:
//   "Hi! Your {{1}} visibility score is {{2}}%. Biggest gap: {{3}}.
//    Reply APPROVE to publish a ready draft, or check your dashboard."
// Create and submit this template in Meta Business Manager > WhatsApp
// Manager > Message Templates before this will work — see setup notes.
// ============================================================

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, whatsapp_number, whatsapp_verified")
    .eq("whatsapp_verified", true)
    .not("whatsapp_number", "is", null);

  const results: { orgId: string; success: boolean; error?: string }[] = [];

  for (const org of orgs ?? []) {
    try {
      const { data: brand } = await supabase.from("brands").select("id, name").eq("org_id", org.id).limit(1).single();
      if (!brand) continue;

      const { data: prompts } = await supabase.from("prompts").select("id, text").eq("brand_id", brand.id);
      const promptIds = (prompts ?? []).map((p) => p.id);

      const { data: runs } = promptIds.length
        ? await supabase.from("visibility_runs").select("prompt_id, brand_mentioned").in("prompt_id", promptIds)
        : { data: [] };

      const total = runs?.length ?? 0;
      const mentioned = runs?.filter((r) => r.brand_mentioned).length ?? 0;
      const score = total > 0 ? Math.round((mentioned / total) * 100) : 0;

      const runsByPrompt = new Map<string, boolean[]>();
      for (const r of runs ?? []) {
        if (!runsByPrompt.has(r.prompt_id)) runsByPrompt.set(r.prompt_id, []);
        runsByPrompt.get(r.prompt_id)!.push(r.brand_mentioned ?? false);
      }
      const biggestGap =
        (prompts ?? []).find((p) => {
          const results2 = runsByPrompt.get(p.id);
          return results2 && results2.every((m) => !m);
        })?.text ?? "no major gaps found";

      await sendTemplateMessage(org.whatsapp_number!, "visibility_digest", [brand.name, String(score), biggestGap]);

      await supabase.from("automation_actions").insert({
        brand_id: brand.id,
        action_type: "send_whatsapp_digest",
        status: "executed",
        approved_via: "whatsapp",
        executed_at: new Date().toISOString(),
        details: { score, biggestGap },
      });

      results.push({ orgId: org.id, success: true });
    } catch (err) {
      results.push({ orgId: org.id, success: false, error: err instanceof Error ? err.message : "unknown error" });
    }
  }

  return NextResponse.json({ success: true, sent: results.filter((r) => r.success).length, results });
}
