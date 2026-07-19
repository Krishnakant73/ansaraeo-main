import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// GET /api/feed/stream?brandId=<uuid>&kinds=<a,b>&missionId=<uuid>&taskId=<uuid>&campaignId=<uuid>
// Server-Sent Events stream of live activity for the given brand.
//
// Emits:
//   event: hello   data: {"ok": true, "since": "<iso>", "filters": {...}}
//   event: feed    data: {"entries": [FeedEntry]}   (only when there are new rows)
//   event: ping    data: {"t": <ms>}                (every 25s to keep the socket warm)
//   event: bye     data: {"reason": "..."}          (before close on server disconnect)
//
// Filters (Step 25):
//   • kinds=alert.fired,scan.completed,task.completed — comma-separated allow-list. If
//     absent, all kinds are emitted (existing behaviour).
//   • missionId  — only emit task events for tasks whose mission_id matches.
//   • taskId     — only emit task events for this specific task (implies task.completed).
//   • campaignId — only emit task events for tasks under missions with this
//     linked_campaign_id.
//
// This is a poll-and-diff bridge, not a Postgres NOTIFY subscription. We
// re-query every POLL_INTERVAL_MS for rows newer than the last emitted
// timestamp and stream any new ones. When we outgrow it, this route is where
// the realtime-subscription upgrade lands — the client contract stays the same.
//
// Auth: cookie client. RLS gates brand access, so an unauthorized user gets
// zero rows and a keep-alive stream (deliberate — we do not want to leak
// brand existence via a 403 vs 200).
// ============================================================

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_INTERVAL_MS = 5_000;
const PING_INTERVAL_MS = 25_000;
const MAX_STREAM_MS = 55_000; // < 60s Vercel serverless timeout

type FeedEntry = {
  id: string;
  kind: string;
  message: string;
  detail?: string;
  href?: string;
  at: string;
};

const ALL_KINDS = new Set([
  "alert.fired",
  "scan.completed",
  "task.completed",
  "engine.change",
  "opportunity.new",
]);

function frame(event: string, data: unknown): Uint8Array {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return new TextEncoder().encode(`event: ${event}\ndata: ${payload}\n\n`);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brandId");
  const missionId = url.searchParams.get("missionId");
  const taskId = url.searchParams.get("taskId");
  const campaignId = url.searchParams.get("campaignId");
  const kindsParam = url.searchParams.get("kinds");
  const kinds = kindsParam
    ? new Set(kindsParam.split(",").map((s) => s.trim()).filter((s) => ALL_KINDS.has(s)))
    : ALL_KINDS;
  const emitsTasks = kinds.has("task.completed");
  const emitsScans = kinds.has("scan.completed");
  const emitsAlerts = kinds.has("alert.fired");
  const emitsEngineChanges = kinds.has("engine.change");
  const emitsOpportunities = kinds.has("opportunity.new");

  const supabase = await createClient();

  // Resolve the brand slug up-front so hrefs into brand-scoped pages
  // (opportunities, engine-matrix, ...) can use the URL grammar instead
  // of leaking uuid segments. RLS-safe: an unauthorized caller reads null.
  let brandSlug: string | null = null;
  if (brandId) {
    const { data: b } = await supabase
      .from("brands")
      .select("slug")
      .eq("id", brandId)
      .maybeSingle();
    brandSlug = (b as { slug: string | null } | null)?.slug ?? null;
  }

  // Baseline "since" is now — the ActivityFeed on page load already
  // includes historical rows; the stream is for *new* things.
  let since = new Date().toISOString();

  async function pollBrand(): Promise<FeedEntry[]> {
    if (!brandId) return [];
    const entries: FeedEntry[] = [];

    // 1. Alerts newly fired since last tick.
    if (emitsAlerts) {
      const { data: firings } = await supabase
        .from("geo_alert_firings")
        .select("id, metric, metric_value, threshold, fired_at")
        .eq("brand_id", brandId)
        .gt("fired_at", since)
        .order("fired_at", { ascending: false })
        .limit(20);
      for (const f of firings ?? []) {
        entries.push({
          id: `alert-${f.id}`,
          kind: "alert.fired",
          message: `Alert: ${f.metric} crossed threshold`,
          detail: `Value ${f.metric_value ?? "n/a"} · threshold ${f.threshold}`,
          href: "/dashboard/alerts",
          at: f.fired_at as string,
        });
      }
    }

    // 2. Visibility runs completed since last tick. We batch to a single
    //    "scan.completed" event per run_at bucket to avoid firehosing.
    if (emitsScans) {
      const { data: runs } = await supabase
        .from("visibility_runs")
        .select("id, run_at")
        .eq("brand_id", brandId)
        .gt("run_at", since)
        .order("run_at", { ascending: false })
        .limit(50);
      if ((runs ?? []).length > 0) {
        const latest = (runs ?? [])[0]!.run_at as string;
        entries.push({
          id: `scan-${latest}`,
          kind: "scan.completed",
          message: `Fresh scan completed (${(runs ?? []).length} run${(runs ?? []).length === 1 ? "" : "s"})`,
          detail: "Visibility, citations, and opportunities were recomputed",
          at: latest,
        });
      }
    }

    // 3. Tasks completed since last tick. Tasks aren't brand-scoped directly
    //    (schema: mission → brand), so we need the brand's mission ids first,
    //    then filter by whichever of missionId / taskId / campaignId was
    //    provided.
    if (emitsTasks) {
      let missionIds: string[] = [];
      if (missionId) {
        missionIds = [missionId];
      } else if (campaignId) {
        const { data: campaignMissions } = await supabase
          .from("missions")
          .select("id")
          .eq("brand_id", brandId)
          .eq("linked_campaign_id", campaignId);
        missionIds = ((campaignMissions as { id: string }[] | null) ?? []).map((m) => m.id);
      } else {
        const { data: brandMissions } = await supabase
          .from("missions")
          .select("id")
          .eq("brand_id", brandId);
        missionIds = ((brandMissions as { id: string }[] | null) ?? []).map((m) => m.id);
      }

      if (taskId) {
        // Single-task subscription: fetch that task directly, but still
        // require it belongs to a mission the user's brand owns (RLS also
        // enforces this — belt-and-braces).
        const { data: t } = await supabase
          .from("tasks")
          .select("id, title, completed_at, mission_id")
          .eq("id", taskId)
          .eq("status", "done")
          .gt("completed_at", since)
          .maybeSingle();
        const row = t as { id: string; title: string; completed_at: string; mission_id: string } | null;
        if (row && (missionIds.length === 0 || missionIds.includes(row.mission_id))) {
          entries.push({
            id: `task-${row.id}`,
            kind: "task.completed",
            message: `Task completed: ${row.title}`,
            href: `/dashboard/w/task/${row.id}/overview`,
            at: row.completed_at,
          });
        }
      } else if (missionIds.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, completed_at, mission_id")
          .in("mission_id", missionIds)
          .eq("status", "done")
          .gt("completed_at", since)
          .order("completed_at", { ascending: false })
          .limit(10);
        for (const t of (tasks as { id: string; title: string; completed_at: string; mission_id: string }[] | null) ?? []) {
          entries.push({
            id: `task-${t.id}`,
            kind: "task.completed",
            message: `Task completed: ${t.title}`,
            href: `/dashboard/w/task/${t.id}/overview`,
            at: t.completed_at,
          });
        }
      }
    }

    // 4. Engine change events since last tick. Two paths: brand-attributed
    //    rows (RLS lets us read them directly by brand_id) and evidence-run
    //    rows (RLS predicate joins through visibility_runs; we still filter
    //    the client-side query by created_at for the tick watermark).
    if (emitsEngineChanges) {
      const { data: events } = await supabase
        .from("engine_change_events")
        .select("id, engine_id, kind, magnitude, summary, occurred_on, created_at")
        .eq("brand_id", brandId)
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10);
      for (const e of (events as {
        id: string;
        engine_id: string;
        kind: string;
        magnitude: number | null;
        summary: string;
        occurred_on: string;
        created_at: string;
      }[] | null) ?? []) {
        // Resolve engine name via the small engines table for a click-through.
        const { data: eng } = await supabase
          .from("engines")
          .select("name")
          .eq("id", e.engine_id)
          .maybeSingle();
        const engineName = (eng as { name: string } | null)?.name;
        entries.push({
          id: `engine-change-${e.id}`,
          kind: "engine.change",
          message: `${e.kind.replace("_", " ")}${e.magnitude != null ? ` · ${e.magnitude >= 0 ? "+" : ""}${e.magnitude}pp` : ""}`,
          detail: e.summary,
          href: engineName
            ? `/dashboard/w/engine/${engineName}/model-changes`
            : undefined,
          at: e.created_at,
        });
      }
    }

    // 5. New opportunity_recommendations rows since last tick. Feeds the
    //    Opportunity Radar band on the Battle Plan tab live.
    if (emitsOpportunities) {
      const { data: opps } = await supabase
        .from("opportunity_recommendations")
        .select("id, title, type, priority_score, engine_id, competitor_id, created_at")
        .eq("brand_id", brandId)
        .gt("created_at", since)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(10);
      for (const o of (opps as {
        id: string;
        title: string;
        type: string;
        priority_score: number | null;
        engine_id: string | null;
        competitor_id: string | null;
        created_at: string;
      }[] | null) ?? []) {
        entries.push({
          id: `opportunity-${o.id}`,
          kind: "opportunity.new",
          message: `New opportunity: ${o.title}`,
          detail: `${o.type}${o.priority_score != null ? ` · priority ${Math.round(Number(o.priority_score))}` : ""}`,
          href: brandSlug ? `/dashboard/b/${brandSlug}/opportunities` : "/dashboard/opportunities",
          at: o.created_at,
        });
      }
    }

    // Bump the watermark to the newest thing we saw. If nothing arrived
    // this tick, leave `since` alone so a slow write still gets picked up.
    for (const e of entries) {
      if (e.at > since) since = e.at;
    }
    return entries;
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let closed = false;

      const close = (reason: string) => {
        if (closed) return;
        closed = true;
        try {
          controller.enqueue(frame("bye", { reason }));
          controller.close();
        } catch {
          /* controller already closed by peer */
        }
      };

      req.signal.addEventListener("abort", () => close("client_disconnect"));

      controller.enqueue(
        frame("hello", {
          ok: true,
          since,
          filters: {
            kinds: Array.from(kinds),
            missionId,
            taskId,
            campaignId,
          },
        }),
      );

      // Ping keeps proxies from closing an idle socket. Uses a separate
      // interval from the poll so a slow query doesn't skip pings.
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(frame("ping", { t: Date.now() }));
        } catch {
          closed = true;
        }
      }, PING_INTERVAL_MS);

      try {
        while (!closed && Date.now() - startedAt < MAX_STREAM_MS) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          if (closed) break;
          try {
            const entries = await pollBrand();
            if (entries.length > 0) {
              controller.enqueue(frame("feed", { entries }));
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "poll_error";
            controller.enqueue(frame("error", { error: msg }));
          }
        }
      } finally {
        clearInterval(ping);
        close(Date.now() - startedAt >= MAX_STREAM_MS ? "budget_exhausted" : "done");
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
