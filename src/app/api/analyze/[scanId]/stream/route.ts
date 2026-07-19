import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { autofillFromDomain } from "@/lib/domain-autofill";
import { generateScanPrompts, type IndustryKey, INDUSTRIES } from "@/lib/starter-prompts";
import { callEngine } from "@/lib/visibility-consistency";
import {
  classifyAnswer,
  buildScanReport,
  type ScanEngineResult,
} from "@/lib/scan-classifier";
import { logActivationEvent } from "@/lib/activation-events";

// ============================================================
// GET /api/analyze/[scanId]/stream — Server-Sent Events (public).
//
// The user just POSTed to /api/analyze and got a scanId. This route
// runs the actual scan and streams narrated progress:
//   event: autofill    { companyName, competitors, category, confidence }
//   event: prompts     { prompts: [text, text, text] }
//   event: engine_start{ engine, prompt }
//   event: engine_done { engine, prompt, mentioned, snippet }
//   event: engine_skip { engine, reason }
//   event: report      { visibilityScore, ... }
//   event: done        { }
//
// On completion the full aggregate is persisted to the `public_scans`
// row so the SSR report page can render directly from the DB. A refresh
// during streaming returns the last-persisted state; if the scan is
// already 'ready', the client should just navigate to the report page.
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // seconds; some engines take a while

const ENGINES = ["chatgpt", "perplexity", "gemini"] as const;

// SSE frame helper — one line per line of `data:`, terminated by blank.
function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Guess IndustryKey from a free-form category string coming out of
// autofillFromDomain(). Defaults to "other" so generateScanPrompts always
// has a valid template set.
function coerceIndustry(category: string | undefined | null): IndustryKey {
  if (!category) return "other";
  const c = category.toLowerCase();
  if (c.includes("fashion") || c.includes("apparel") || c.includes("clothing")) return "d2c_fashion";
  if (c.includes("beauty") || c.includes("skincare") || c.includes("cosmetic")) return "d2c_beauty";
  if (c.includes("food") || c.includes("beverage") || c.includes("snack")) return "d2c_food";
  if (c.includes("saas") || c.includes("b2b") || c.includes("software") || c.includes("platform")) return "saas";
  if (c.includes("local") || c.includes("service") || c.includes("salon") || c.includes("clinic")) return "local_service";
  const match = INDUSTRIES.find((i) => c.includes(i.value));
  return (match?.value as IndustryKey) ?? "other";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ scanId: string }> }) {
  const { scanId } = await params;
  const sb = createServiceClient();

  const { data: scan, error: scanErr } = await sb
    .from("public_scans")
    .select("id, domain, canonical_domain, status, autofill_json, prompts_json, engine_results_json, report_json")
    .eq("id", scanId)
    .single();

  if (scanErr || !scan) {
    return new Response(JSON.stringify({ error: "scan not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If already ready, tell the client so it navigates to the report.
  if (scan.status === "ready" && scan.report_json) {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseFrame("autofill", scan.autofill_json ?? {})));
        controller.enqueue(new TextEncoder().encode(sseFrame("prompts", { prompts: scan.prompts_json ?? [] })));
        controller.enqueue(new TextEncoder().encode(sseFrame("report", scan.report_json)));
        controller.enqueue(new TextEncoder().encode(sseFrame("done", { cached: true })));
        controller.close();
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseFrame(event, data)));
        } catch {
          // Client closed the connection — nothing to do; the async
          // work below will complete and persist regardless.
        }
      };

      const started = Date.now();
      const emitLatency = () =>
        send("elapsed", { ms: Date.now() - started });

      try {
        await sb.from("public_scans").update({ status: "streaming" }).eq("id", scan.id);

        // 1. Autofill
        send("step", { label: "Detecting the brand" });
        let autofill = scan.autofill_json;
        if (!autofill) {
          try {
            autofill = await autofillFromDomain(scan.canonical_domain);
          } catch {
            autofill = {
              companyName: scan.canonical_domain,
              shortDescription: "",
              suggestedCategory: "",
              suggestedCompetitors: [],
              confidence: "low",
            };
          }
          await sb.from("public_scans").update({ autofill_json: autofill }).eq("id", scan.id);
        }
        send("autofill", autofill);
        emitLatency();

        const brandName: string = (autofill?.companyName as string) || scan.canonical_domain;
        const competitorNames: string[] =
          Array.isArray((autofill as { suggestedCompetitors?: unknown }).suggestedCompetitors)
            ? ((autofill as { suggestedCompetitors: unknown[] }).suggestedCompetitors.filter(
                (v): v is string => typeof v === "string",
              ) as string[]).slice(0, 6)
            : [];
        const industry = coerceIndustry((autofill as { suggestedCategory?: string }).suggestedCategory);
        const category = ((autofill as { suggestedCategory?: string }).suggestedCategory as string) || "brands";

        // 2. Prompts
        const prompts = generateScanPrompts({
          industry,
          category,
          competitor: competitorNames[0],
        });
        await sb.from("public_scans").update({ prompts_json: prompts }).eq("id", scan.id);
        send("prompts", { prompts });
        emitLatency();

        // 3. Engine calls, parallel per (prompt × engine).
        // Each cell fires its own async worker; the ready-order of
        // completion is what the user sees streaming. The worker returns
        // its ScanEngineResult so we accumulate them into one array.
        const cells: { prompt: string; engine: string }[] = [];
        for (const p of prompts) for (const e of ENGINES) cells.push({ prompt: p.text, engine: e });

        send("scan_start", { total: cells.length });

        const results: ScanEngineResult[] = await Promise.all(
          cells.map(async ({ prompt, engine }) => {
            send("engine_start", { engine, prompt });
            let content = "";
            let errorMsg: string | undefined;
            try {
              content = await callEngine(engine, prompt);
            } catch (err) {
              errorMsg = (err as Error).message;
            }

            if (errorMsg) {
              const r: ScanEngineResult = {
                engine,
                prompt,
                content: "",
                cited_urls: [],
                classified: null,
                error: errorMsg,
                skipped: true,
                skip_reason: errorMsg.includes("API_KEY") ? "engine key not configured" : "engine error",
              };
              send("engine_skip", { engine, prompt, reason: r.skip_reason });
              return r;
            }

            let classified = null;
            try {
              classified = await classifyAnswer({
                responseText: content,
                brandName,
                competitorNames,
                promptText: prompt,
              });
            } catch (err) {
              errorMsg = `classifier: ${(err as Error).message}`;
            }

            const r: ScanEngineResult = {
              engine,
              prompt,
              content,
              cited_urls: [],
              classified,
              error: errorMsg,
            };

            const snippet = content.slice(0, 220);
            send("engine_done", {
              engine,
              prompt,
              mentioned: classified?.brand_mentioned ?? false,
              competitors: classified?.competitor_mentions.filter((c) => c.mentioned).map((c) => c.name) ?? [],
              sentiment: classified?.sentiment ?? "neutral",
              snippet,
            });
            emitLatency();
            return r;
          }),
        );

        // 4. Report
        const report = buildScanReport({
          brandName,
          domain: scan.canonical_domain,
          competitorNames,
          results,
        });

        await sb
          .from("public_scans")
          .update({
            status: "ready",
            engine_results_json: results,
            report_json: report,
          })
          .eq("id", scan.id);

        send("report", report);
        send("done", { elapsedMs: Date.now() - started });

        await logActivationEvent({
          event: "scan_completed",
          payload: {
            scanId: scan.id,
            visibilityScore: report.visibilityScore,
            totalAnswers: report.totalAnswers,
          },
        });
      } catch (err) {
        send("error", { message: (err as Error).message });
        await sb.from("public_scans").update({ status: "failed" }).eq("id", scan.id);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
