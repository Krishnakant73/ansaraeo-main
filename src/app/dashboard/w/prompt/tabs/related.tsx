import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { intentLabel } from "@/lib/intent";
import type { Prompt } from "@/lib/prompt-workspace";

// ============================================================
// Prompt › Related — related-prompt discovery + a lightweight
// prompt graph (SVG, no new deps). Two signals feed the "related"
// list, deterministic-only in v1:
//   1. Same-brand prompts sharing intent or category
//   2. Prompts that co-cite ≥1 domain in the last 30d (SQL-only)
// The graph shows the center prompt, ring-1 related prompts, and
// ring-2 top cited domains, with edges styled by relation.
// ============================================================

type RelatedPrompt = {
  id: string;
  text: string;
  intent: string | null;
  category: string | null;
  reason: "intent" | "category" | "co_citation";
  overlap?: number;
  mentionRate?: number | null;
};

export default async function RelatedBody({ prompt }: { prompt: Prompt }) {
  const supabase = await createClient();

  // Step 1: sibling prompts by intent + category.
  const { data: siblings } = await supabase
    .from("prompts")
    .select("id, text, intent, category")
    .eq("brand_id", prompt.brand_id)
    .neq("id", prompt.id)
    .limit(60);
  const sibs = (siblings as { id: string; text: string; intent: string | null; category: string | null }[] | null) ?? [];

  const related: RelatedPrompt[] = [];
  const seen = new Set<string>();

  for (const s of sibs) {
    if (prompt.intent && s.intent === prompt.intent) {
      related.push({ ...s, reason: "intent" });
      seen.add(s.id);
    }
  }
  for (const s of sibs) {
    if (seen.has(s.id)) continue;
    if (prompt.category && s.category && s.category === prompt.category) {
      related.push({ ...s, reason: "category" });
      seen.add(s.id);
    }
  }

  // Step 2: co-citation. Get domains cited when answering THIS prompt, then
  // find sibling prompts whose runs cite the same domains.
  const { data: myRuns } = await supabase
    .from("visibility_runs")
    .select("id")
    .eq("prompt_id", prompt.id)
    .limit(200);
  const myRunIds = ((myRuns as { id: string }[] | null) ?? []).map((r) => r.id);

  const domainOverlap = new Map<string, number>();
  const topDomains: string[] = [];
  if (myRunIds.length > 0) {
    const { data: myCites } = await supabase
      .from("citations")
      .select("cited_domain, run_id")
      .in("run_id", myRunIds);
    const myDomains = new Set<string>();
    for (const c of (myCites as { cited_domain: string | null }[] | null) ?? []) {
      if (c.cited_domain) myDomains.add(c.cited_domain);
    }
    const domainFreq = new Map<string, number>();
    for (const c of (myCites as { cited_domain: string | null }[] | null) ?? []) {
      if (!c.cited_domain) continue;
      domainFreq.set(c.cited_domain, (domainFreq.get(c.cited_domain) ?? 0) + 1);
    }
    Array.from(domainFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([d]) => topDomains.push(d));

    // For every sibling, check citation overlap by fetching their run ids
    // then their citations. Bounded: 60 siblings × 1 query = fine.
    if (sibs.length > 0 && myDomains.size > 0) {
      const sibIds = sibs.map((s) => s.id);
      const { data: sibRuns } = await supabase
        .from("visibility_runs")
        .select("id, prompt_id")
        .in("prompt_id", sibIds)
        .limit(1000);
      const runByPrompt = new Map<string, string[]>();
      for (const r of (sibRuns as { id: string; prompt_id: string }[] | null) ?? []) {
        const arr = runByPrompt.get(r.prompt_id) ?? [];
        arr.push(r.id);
        runByPrompt.set(r.prompt_id, arr);
      }
      const allSibRunIds = Array.from(runByPrompt.values()).flat();
      if (allSibRunIds.length > 0) {
        const { data: sibCites } = await supabase
          .from("citations")
          .select("cited_domain, run_id")
          .in("run_id", allSibRunIds);
        const runToPrompt = new Map<string, string>();
        for (const [pid, rids] of runByPrompt.entries()) {
          for (const rid of rids) runToPrompt.set(rid, pid);
        }
        const overlapByPrompt = new Map<string, Set<string>>();
        for (const c of (sibCites as { cited_domain: string | null; run_id: string }[] | null) ?? []) {
          if (!c.cited_domain) continue;
          if (!myDomains.has(c.cited_domain)) continue;
          const pid = runToPrompt.get(c.run_id);
          if (!pid) continue;
          const set = overlapByPrompt.get(pid) ?? new Set<string>();
          set.add(c.cited_domain);
          overlapByPrompt.set(pid, set);
        }
        for (const s of sibs) {
          if (seen.has(s.id)) continue;
          const overlap = overlapByPrompt.get(s.id);
          if (overlap && overlap.size > 0) {
            related.push({ ...s, reason: "co_citation", overlap: overlap.size });
            seen.add(s.id);
            domainOverlap.set(s.id, overlap.size);
          }
        }
      }
    }
  }

  const items = related.slice(0, 15);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Related prompts</h2>
        <p className="mt-1 text-sm text-muted">
          Other prompts in {prompt.brand.name}&rsquo;s tracked set that share intent, category,
          or cited sources with this one.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* Left: related list */}
        <div className="rounded-2xl border border-line bg-white">
          {items.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-ink">No related prompts found yet.</p>
              <p className="mt-1 text-xs text-muted">
                Add more prompts under the same intent, or generate a Prompt Suite from Brand › Prompts.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((r) => (
                <li key={r.id} className="p-4">
                  <Link
                    href={`/dashboard/w/prompt/${r.id}/overview`}
                    className="block hover:text-accent"
                  >
                    <p className="line-clamp-2 text-sm font-medium text-ink hover:text-accent">
                      {r.text}
                    </p>
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip">{intentLabel(r.intent)}</span>
                    <span className="chip">
                      {r.reason === "co_citation"
                        ? `co-cites ${r.overlap} source${r.overlap === 1 ? "" : "s"}`
                        : r.reason === "intent"
                          ? "same intent"
                          : "same category"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: prompt graph */}
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="section-label">Prompt graph</p>
          <div className="mt-2">
            <PromptGraph
              center={prompt.text}
              related={items.slice(0, 6).map((r) => ({
                id: r.id,
                label: shortText(r.text, 36),
                relation: r.reason,
              }))}
              domains={topDomains.slice(0, 5)}
            />
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Solid edges = shared intent/category. Dashed edges = co-cited domain.
          </p>
        </div>
      </div>
    </div>
  );
}

function shortText(t: string, n: number): string {
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

// Static SVG graph — deterministic layout, no runtime physics. Handles up
// to ~12 nodes gracefully; falls back to an empty pane on zero related.
function PromptGraph({
  center,
  related,
  domains,
}: {
  center: string;
  related: { id: string; label: string; relation: "intent" | "category" | "co_citation" }[];
  domains: string[];
}) {
  const W = 380;
  const H = 320;
  const cx = W / 2;
  const cy = H / 2;
  const r1 = 90; // related ring
  const r2 = 140; // domain ring

  const relatedPos = related.map((r, i) => {
    const angle = (i / Math.max(1, related.length)) * Math.PI * 2 - Math.PI / 2;
    return { ...r, x: cx + r1 * Math.cos(angle), y: cy + r1 * Math.sin(angle) };
  });
  const domainPos = domains.map((d, i) => {
    const angle = (i / Math.max(1, domains.length)) * Math.PI * 2 + Math.PI / 6;
    return { d, x: cx + r2 * Math.cos(angle), y: cy + r2 * Math.sin(angle) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Prompt relationship graph">
      {/* Edges to related prompts */}
      {relatedPos.map((r) => (
        <line
          key={`e-r-${r.id}`}
          x1={cx}
          y1={cy}
          x2={r.x}
          y2={r.y}
          stroke="currentColor"
          className={r.relation === "co_citation" ? "text-line" : "text-accent/60"}
          strokeWidth={1.2}
          strokeDasharray={r.relation === "co_citation" ? "3 3" : undefined}
        />
      ))}
      {/* Edges to domains (dashed) */}
      {domainPos.map((d) => (
        <line
          key={`e-d-${d.d}`}
          x1={cx}
          y1={cy}
          x2={d.x}
          y2={d.y}
          stroke="currentColor"
          className="text-muted/40"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      ))}
      {/* Domain nodes */}
      {domainPos.map((d) => (
        <g key={`d-${d.d}`}>
          <circle cx={d.x} cy={d.y} r={5} className="fill-white stroke-line" strokeWidth={1} />
          <text
            x={d.x}
            y={d.y - 8}
            textAnchor="middle"
            className="fill-muted"
            fontSize={9}
          >
            {shortText(d.d, 18)}
          </text>
        </g>
      ))}
      {/* Related prompt nodes */}
      {relatedPos.map((r) => (
        <g key={`r-${r.id}`}>
          <circle
            cx={r.x}
            cy={r.y}
            r={7}
            className={r.relation === "co_citation" ? "fill-white stroke-accent" : "fill-accent/20 stroke-accent"}
            strokeWidth={1.5}
          />
          <text
            x={r.x}
            y={r.y + 18}
            textAnchor="middle"
            className="fill-ink"
            fontSize={9}
          >
            {r.label}
          </text>
        </g>
      ))}
      {/* Center node */}
      <circle cx={cx} cy={cy} r={12} className="fill-accent" />
      <text x={cx} y={cy + 4} textAnchor="middle" className="fill-white" fontSize={10} fontWeight={600}>
        ★
      </text>
      <text x={cx} y={cy + 30} textAnchor="middle" className="fill-ink" fontSize={9}>
        {shortText(center, 32)}
      </text>
    </svg>
  );
}
