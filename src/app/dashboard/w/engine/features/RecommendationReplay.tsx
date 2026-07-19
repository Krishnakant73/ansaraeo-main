import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import { timeAgo, type Engine } from "@/lib/engine-workspace";

// ============================================================
// RecommendationReplay — server component that renders the raw
// response of the most recent (or a specified) run with brand,
// competitor, and citation-domain spans highlighted.
//
// Deterministic overlay: string-index scan, no LLM. This is how
// customers reason "why did the engine recommend them?" — you can
// see the exact text.
// ============================================================

type Row = {
  id: string;
  run_at: string;
  prompt_id: string;
  raw_response: string | null;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

type Highlight = {
  start: number;
  end: number;
  kind: "brand" | "competitor" | "citation";
  label: string;
};

export default async function RecommendationReplay({
  engine,
  runId,
}: {
  engine: Engine;
  runId?: string;
}) {
  const supabase = await createClient();

  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", engine.brand.id)
    .limit(500);
  const promptList = (prompts as { id: string; text: string }[] | null) ?? [];
  const promptText = new Map(promptList.map((p) => [p.id, p.text]));
  const promptIds = promptList.map((p) => p.id);

  let run: Row | null = null;
  if (promptIds.length > 0) {
    const query = supabase
      .from("visibility_runs")
      .select("id, run_at, prompt_id, raw_response, brand_mentioned, competitor_mentions")
      .eq("engine_id", engine.id)
      .in("prompt_id", promptIds)
      .order("run_at", { ascending: false })
      .limit(1);
    if (runId) query.eq("id", runId);
    const { data } = await query;
    run = ((data as Row[] | null) ?? [])[0] ?? null;
  }

  if (!run || !run.raw_response) {
    return (
      <EmptyStateCoach
        title="Nothing to replay yet"
        description={`Run a scan on ${engine.displayName} so we can walk you through why it recommended what it did.`}
        action={{
          label: "Run visibility scan",
          href: `/dashboard/b/${engine.brand.slug}/visibility`,
        }}
      />
    );
  }

  let citations: { cited_domain: string | null; is_own_domain: boolean | null }[] = [];
  {
    const { data } = await supabase
      .from("citations")
      .select("cited_domain, is_own_domain")
      .eq("run_id", run.id);
    citations = (data as typeof citations) ?? [];
  }

  const text = run.raw_response;
  const highlights: Highlight[] = [];

  // Brand span.
  addSpans(highlights, text, engine.brand.name, "brand", engine.brand.name);
  // Competitor spans.
  for (const c of run.competitor_mentions ?? []) {
    if (!c.mentioned) continue;
    addSpans(highlights, text, c.name, "competitor", c.name);
  }
  // Citation-domain spans (only if the domain literally appears in text).
  for (const c of citations) {
    if (!c.cited_domain) continue;
    addSpans(highlights, text, c.cited_domain, "citation", c.cited_domain);
  }

  const segments = renderSegments(text, highlights);

  return (
    <section aria-label={`Replay of ${engine.displayName} run`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <p className="section-label">Recommendation replay</p>
          <p className="mt-1 text-sm text-muted">
            The engine&rsquo;s exact answer with your brand, competitors, and cited domains highlighted.
          </p>
        </div>
        <Link
          href={`/dashboard/w/prompt/${run.prompt_id}/history?run=${run.id}`}
          className="text-xs font-medium text-accent hover:underline"
        >
          Open full run →
        </Link>
      </div>
      <article className="mt-3 rounded-2xl border border-line bg-white p-4">
        <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
          <p className="line-clamp-1 text-sm font-medium text-ink">
            &ldquo;{promptText.get(run.prompt_id) ?? "prompt"}&rdquo;
          </p>
          <span className="shrink-0 text-[11px] text-muted">{timeAgo(run.run_at)}</span>
        </div>
        <div className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink/90">
          {segments}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-2 text-[11px]">
          <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">You</span>
          <span className="chip border-rose-200 bg-rose-50 text-rose-600">Competitor</span>
          <span className="chip chip-accent">Citation</span>
        </div>
      </article>
    </section>
  );
}

function addSpans(
  out: Highlight[],
  text: string,
  needle: string,
  kind: Highlight["kind"],
  label: string,
) {
  if (!needle) return;
  const lower = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let idx = 0;
  while (idx < lower.length) {
    const found = lower.indexOf(lowerNeedle, idx);
    if (found === -1) break;
    // Simple word-boundary check to avoid matching mid-word for short needles.
    const beforeOk = found === 0 || !/[a-z0-9]/.test(lower[found - 1] ?? "");
    const afterOk =
      found + lowerNeedle.length === lower.length ||
      !/[a-z0-9]/.test(lower[found + lowerNeedle.length] ?? "");
    if (beforeOk && afterOk) {
      out.push({ start: found, end: found + needle.length, kind, label });
    }
    idx = found + lowerNeedle.length;
  }
}

function renderSegments(text: string, highlights: Highlight[]): React.ReactNode[] {
  if (highlights.length === 0) return [text];
  // Sort by start; when spans overlap, prefer earlier and longer.
  const sorted = [...highlights].sort((a, b) => a.start - b.start || b.end - a.end);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const h of sorted) {
    if (h.start < cursor) continue; // skip overlap
    if (h.start > cursor) {
      nodes.push(<span key={`t-${key++}`}>{text.slice(cursor, h.start)}</span>);
    }
    const cls =
      h.kind === "brand"
        ? "rounded bg-emerald-100 px-0.5 text-emerald-800"
        : h.kind === "competitor"
          ? "rounded bg-rose-100 px-0.5 text-rose-700"
          : "rounded bg-accent/15 px-0.5 text-accent";
    nodes.push(
      <mark key={`h-${key++}`} className={cls} title={h.label}>
        {text.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  }
  if (cursor < text.length) {
    nodes.push(<span key={`t-${key++}`}>{text.slice(cursor)}</span>);
  }
  return nodes;
}
