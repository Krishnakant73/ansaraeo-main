import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyStateCoach } from "@/workspace/primitives";
import { timeAgo, type Competitor } from "@/lib/competitor-workspace";

// ============================================================
// Competitor › Timeline — full-fidelity chronological view. Union
// of visibility_runs (gap / contested), citation appearances, and
// competitor_snapshots step-changes when migration 028 is live.
// Grouped by day; a sticky day header carries the date + summary
// count so scrolling stays oriented.
//
// Event cards are object-linked (deep-link into the exact run in
// the prompt workspace's RunReplayDrawer). Filter chips reduce the
// event set by kind without a page reload — implemented via
// search params so the URL stays shareable.
// ============================================================

type Row = {
  id: string;
  run_at: string;
  prompt_id: string;
  engine_id: string;
  brand_mentioned: boolean | null;
  competitor_mentions: { name: string; mentioned: boolean; position: number | null }[] | null;
};

type Event = {
  id: string;
  at: string;
  kind: "gap" | "contested" | "position-change" | "snapshot" | "yours";
  title: string;
  detail?: string;
  href?: string;
  track: "them" | "you";
};

const KIND_LABEL: Record<Event["kind"], string> = {
  gap: "They win",
  contested: "Contested",
  "position-change": "Position change",
  snapshot: "Snapshot",
  yours: "Your move",
};

const KIND_TONE: Record<Event["kind"], string> = {
  gap: "border-rose-200 bg-rose-50 text-rose-700",
  contested: "border-amber-200 bg-amber-50 text-amber-700",
  "position-change": "border-accent/20 bg-accent/10 text-accent",
  snapshot: "border-line bg-white text-muted",
  yours: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default async function TimelineBody({
  competitor,
  searchParams,
}: {
  competitor: Competitor;
  searchParams?: URLSearchParams;
}) {
  const activeFilter = (searchParams?.get("kind") ?? "all") as Event["kind"] | "all";
  const showMine = searchParams?.get("mine") === "1";

  const supabase = await createClient();
  const { data: prompts } = await supabase
    .from("prompts")
    .select("id, text")
    .eq("brand_id", competitor.brand_id)
    .limit(500);
  const promptList = (prompts as { id: string; text: string }[] | null) ?? [];
  const promptText = new Map(promptList.map((p) => [p.id, p.text]));
  const promptIds = promptList.map((p) => p.id);

  const events: Event[] = [];
  const engineMap = new Map<string, string>();

  if (promptIds.length > 0) {
    const [runsRes, enginesRes, snapshotsRes] = await Promise.all([
      supabase
        .from("visibility_runs")
        .select("id, run_at, prompt_id, engine_id, brand_mentioned, competitor_mentions")
        .in("prompt_id", promptIds)
        .order("run_at", { ascending: false })
        .limit(200),
      supabase.from("engines").select("id, name"),
      supabase
        .from("competitor_snapshots")
        .select("captured_on, gap_pp")
        .eq("competitor_id", competitor.id)
        .order("captured_on", { ascending: false })
        .limit(60),
    ]);

    for (const e of (enginesRes.data as { id: string; name: string }[] | null) ?? []) {
      engineMap.set(e.id, e.name);
    }

    const nameLower = competitor.name.toLowerCase();
    for (const r of (runsRes.data as Row[] | null) ?? []) {
      const hit = (r.competitor_mentions ?? []).find(
        (m) => m.mentioned && m.name.toLowerCase() === nameLower,
      );
      if (!hit) continue;
      const engine = (engineMap.get(r.engine_id) ?? "engine").replace(/_/g, " ");
      const prompt = (promptText.get(r.prompt_id) ?? "prompt").slice(0, 90);
      const kind: Event["kind"] = r.brand_mentioned === true ? "contested" : "gap";
      events.push({
        id: `run-${r.id}`,
        at: r.run_at,
        kind,
        title: prompt,
        detail: `${engine} · ${KIND_LABEL[kind].toLowerCase()}${hit.position ? ` · rank #${hit.position}` : ""}`,
        href: `/dashboard/w/prompt/${r.prompt_id}/history?run=${r.id}`,
        track: "them",
      });
    }

    // Snapshot step-changes: only surface days where gap moved ≥ 5pp.
    const snapshots =
      ((snapshotsRes.data as { captured_on: string; gap_pp: number | null }[] | null) ?? []).filter(
        (s) => s.gap_pp != null,
      );
    for (let i = 0; i < snapshots.length - 1; i++) {
      const a = snapshots[i].gap_pp!;
      const b = snapshots[i + 1].gap_pp!;
      const d = a - b;
      if (Math.abs(d) < 5) continue;
      events.push({
        id: `snap-${snapshots[i].captured_on}`,
        at: `${snapshots[i].captured_on}T12:00:00Z`,
        kind: "position-change",
        title: d > 0 ? `Gap widened by ${d.toFixed(1)}pp` : `Gap narrowed by ${(-d).toFixed(1)}pp`,
        detail: `Snapshot ${snapshots[i].captured_on}`,
        track: "them",
      });
    }

    // "Show mine" — overlay your brand's action events. Reads content
    // publishes (content_items.published_at within 90d) and sprints
    // closed (missions with status=done, since they represent your
    // completed moves). Lightweight join; skipped when toggle is off.
    if (showMine) {
      // eslint-disable-next-line react-hooks/purity
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const [contentRes, missionsRes] = await Promise.all([
        supabase
          .from("content_items")
          .select("id, title, published_at, url")
          .eq("brand_id", competitor.brand_id)
          .not("published_at", "is", null)
          .gte("published_at", ninetyDaysAgo)
          .order("published_at", { ascending: false })
          .limit(30),
        supabase
          .from("missions")
          .select("id, title, closed_at, status")
          .eq("brand_id", competitor.brand_id)
          .eq("status", "done")
          .not("closed_at", "is", null)
          .gte("closed_at", ninetyDaysAgo)
          .order("closed_at", { ascending: false })
          .limit(30),
      ]);
      for (const c of (contentRes.data as {
        id: string;
        title: string | null;
        published_at: string;
        url: string | null;
      }[] | null) ?? []) {
        events.push({
          id: `content-${c.id}`,
          at: c.published_at,
          kind: "yours",
          title: c.title ?? "Content published",
          detail: c.url ? "Content published" : "Content published",
          href: `/dashboard/w/content/${c.id}/overview`,
          track: "you",
        });
      }
      for (const m of (missionsRes.data as {
        id: string;
        title: string | null;
        closed_at: string;
      }[] | null) ?? []) {
        events.push({
          id: `mission-${m.id}`,
          at: m.closed_at,
          kind: "yours",
          title: m.title ?? "Mission closed",
          detail: "Mission completed",
          href: `/dashboard/w/mission/${m.id}/overview`,
          track: "you",
        });
      }
    }
  }

  const filtered =
    activeFilter === "all" ? events : events.filter((e) => e.kind === activeFilter);
  const sorted = filtered.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 200);

  // Group by day for the sticky headers.
  const groups = new Map<string, Event[]>();
  for (const e of sorted) {
    const day = e.at.slice(0, 10);
    (groups.get(day) ?? groups.set(day, []).get(day)!).push(e);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Timeline</h2>
          <p className="mt-1 text-sm text-muted">
            Every event involving {competitor.name} — runs, gap changes, and snapshots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/dashboard/w/competitor/${competitor.id}/timeline${
              showMine
                ? activeFilter !== "all"
                  ? `?kind=${activeFilter}`
                  : ""
                : `?mine=1${activeFilter !== "all" ? `&kind=${activeFilter}` : ""}`
            }`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              showMine
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-line bg-white text-muted hover:border-accent/40 hover:text-ink"
            }`}
            aria-pressed={showMine}
          >
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${
                showMine ? "bg-emerald-500" : "bg-muted/50"
              }`}
            />
            Show mine
          </Link>
          <FilterChips active={activeFilter} baseHref="?" competitorId={competitor.id} showMine={showMine} />
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyStateCoach
          title="Nothing to show yet"
          description={`Run a visibility scan on the brand and this competitor's activity will appear here.`}
          action={{
            label: "Run visibility scan",
            href: `/dashboard/b/${competitor.brand.slug}/visibility`,
          }}
        />
      ) : (
        <div className="space-y-6">
          {Array.from(groups.entries()).map(([day, dayEvents]) => (
            <section key={day}>
              <div className="sticky top-[calc(var(--ws-header-h)+var(--ws-summary-h)+var(--ws-tab-h))] z-10 mb-2 flex items-baseline gap-2 bg-white/95 py-1 backdrop-blur">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink">
                  {new Date(day).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
                <span className="text-[11px] text-muted">
                  · {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                </span>
              </div>
              <ol className="space-y-2">
                {dayEvents.map((e) => (
                  <li key={e.id}>
                    <TimelineCard event={e} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChips({
  active,
  competitorId,
  showMine,
}: {
  active: Event["kind"] | "all";
  baseHref: string;
  competitorId: string;
  showMine: boolean;
}) {
  const chips: { key: Event["kind"] | "all"; label: string }[] = [
    { key: "all", label: "All events" },
    { key: "gap", label: "Gaps" },
    { key: "contested", label: "Contested" },
    { key: "position-change", label: "Position changes" },
    ...(showMine ? ([{ key: "yours" as const, label: "Your moves" }]) : []),
  ];
  const mineParam = showMine ? "mine=1" : "";
  return (
    <nav aria-label="Filter timeline by event kind" className="flex flex-wrap gap-1.5">
      {chips.map((c) => {
        const isActive = active === c.key;
        const query = c.key === "all"
          ? mineParam
            ? `?${mineParam}`
            : ""
          : `?${mineParam ? `${mineParam}&` : ""}kind=${c.key}`;
        return (
          <Link
            key={c.key}
            href={`/dashboard/w/competitor/${competitorId}/timeline${query}`}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isActive
                ? "border-accent bg-accent text-white"
                : "border-line bg-white text-muted hover:border-accent/40 hover:text-ink"
            }`}
            aria-current={isActive ? "true" : undefined}
          >
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}

function TimelineCard({ event }: { event: Event }) {
  const body = (
    <article
      className={`flex items-start gap-3 rounded-2xl border bg-white p-3 transition-colors ${
        event.href ? "hover:border-accent/40" : ""
      }`}
    >
      <span
        className={`chip mt-0.5 shrink-0 ${KIND_TONE[event.kind]}`}
        aria-label={`Event type ${KIND_LABEL[event.kind]}`}
      >
        {KIND_LABEL[event.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-ink">{event.title}</p>
        {event.detail && <p className="mt-0.5 text-[11px] text-muted">{event.detail}</p>}
      </div>
      <time className="shrink-0 whitespace-nowrap text-[11px] text-muted" dateTime={event.at}>
        {timeAgo(event.at)}
      </time>
    </article>
  );
  return event.href ? <Link href={event.href}>{body}</Link> : body;
}
