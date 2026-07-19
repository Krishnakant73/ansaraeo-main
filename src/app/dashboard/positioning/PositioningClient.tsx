"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Plus, X, Save } from "lucide-react";

type Positioning = {
  category: string | null;
  target_customer: string | null;
  differentiators: string[] | null;
  best_for: string[] | null;
  transformation_from: string | null;
  transformation_to: string | null;
};

type Aggregate = {
  perceived_categories: { value: string; count: number }[];
  strengths: { value: string; count: number }[];
  weaknesses: { value: string; count: number }[];
  recommended_for: { value: string; count: number }[];
  tone_mix: { positive: number; neutral: number; negative: number };
};

type Gap = {
  categoryMatch: boolean;
  differentiatorsCovered: string[];
  differentiatorsMissing: string[];
  bestForCovered: string[];
  bestForMissing: string[];
  alignmentScore: number;
};

type EvidenceRow = {
  id: string;
  engine_id: string | null;
  perceived_category: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  recommended_for: string[] | null;
  tone: string;
  created_at: string;
};

const TONE_LABEL: Record<string, string> = { positive: "Positive", neutral: "Neutral", negative: "Negative" };

export default function PositioningClient({ brandId }: { brandId: string }) {
  const [position, setPosition] = useState<Positioning | null>(null);
  const [aggregate, setAggregate] = useState<Aggregate | null>(null);
  const [gap, setGap] = useState<Gap | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [pos, ev] = await Promise.all([
      fetch("/api/positioning").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/positioning/perception?limit=50").then((r) => (r.ok ? r.json() : null)),
    ]);
    if (pos) {
      setPosition(pos.position);
      setAggregate(pos.aggregate);
      setGap(pos.gap);
    }
    if (ev) setEvidence(ev.rows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [brandId]);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/positioning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: position?.category ?? null,
        target_customer: position?.target_customer ?? null,
        differentiators: position?.differentiators ?? [],
        best_for: position?.best_for ?? [],
        transformation_from: position?.transformation_from ?? null,
        transformation_to: position?.transformation_to ?? null,
      }),
    });
    setSaving(false);
    if (res.ok) await load();
  }

  function update(patch: Partial<Positioning>) {
    setPosition((p) => ({ ...(p ?? emptyPosition()), ...patch }));
  }

  if (loading) return <div className="text-sm text-muted">Loading…</div>;

  const hasData = (aggregate?.perceived_categories.length ?? 0) > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Intended positioning editor */}
      <Panel title="Intended positioning" description="How you want to be described. Editable any time.">
        <div className="space-y-4">
          <Field label="Category">
            <input
              className="input"
              value={position?.category ?? ""}
              placeholder="e.g. AI search visibility tool"
              onChange={(e) => update({ category: e.target.value || null })}
            />
          </Field>
          <Field label="Target customer">
            <input
              className="input"
              value={position?.target_customer ?? ""}
              placeholder="e.g. Indian D2C brands & agencies"
              onChange={(e) => update({ target_customer: e.target.value || null })}
            />
          </Field>
          <ChipField
            label="Key differentiators"
            values={position?.differentiators ?? []}
            onChange={(v) => update({ differentiators: v })}
            placeholder="Add a differentiator and press Enter"
          />
          <ChipField
            label="Best for"
            values={position?.best_for ?? []}
            onChange={(v) => update({ best_for: v })}
            placeholder="Add a use case and press Enter"
          />
          <Field label="Transformation (From → To)">
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                value={position?.transformation_from ?? ""}
                placeholder="invisible in AI search"
                onChange={(e) => update({ transformation_from: e.target.value || null })}
              />
              <span className="text-muted">→</span>
              <input
                className="input flex-1"
                value={position?.transformation_to ?? ""}
                placeholder="consistently recommended"
                onChange={(e) => update({ transformation_to: e.target.value || null })}
              />
            </div>
          </Field>
          <button className="btn-primary" disabled={saving} onClick={save}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save positioning"}
          </button>
        </div>
      </Panel>

      {/* Actual perception */}
      <Panel title="Actual AI perception" description="How AI answers describe your brand (aggregated from real runs).">
        {hasData ? (
          <div className="space-y-4">
            <Stat label="Perceived category" value={aggregate!.perceived_categories[0]?.value ?? "—"} />
            <CountList title="Strengths attributed" items={aggregate!.strengths} />
            <CountList title="Weaknesses / caveats" items={aggregate!.weaknesses} />
            <CountList title="Recommended for" items={aggregate!.recommended_for} />
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Tone mix</p>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="chip">Positive {aggregate!.tone_mix.positive}</span>
                <span className="chip">Neutral {aggregate!.tone_mix.neutral}</span>
                <span className="chip">Negative {aggregate!.tone_mix.negative}</span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No perception data yet"
            description="Run visibility checks for your prompts. Each time an engine mentions your brand, we capture how it describes you."
          />
        )}
      </Panel>

      {/* Gap */}
      <Panel
        title="Positioning gap"
        description="Intended vs. what AI actually says. Score is a deterministic proxy, not a ranking."
        className="lg:col-span-2"
      >
        {hasData ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-ink">{gap?.alignmentScore ?? 0}</span>
                <span className="text-sm text-muted">/ 100 alignment</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {gap?.categoryMatch ? "Category matches" : "Category mismatch"} · based on {aggregate!.perceived_categories.length} runs
              </p>
            </div>
            <div className="space-y-3">
              <GapList title="Differentiators surfaced" covered={gap?.differentiatorsCovered ?? []} missing={gap?.differentiatorsMissing ?? []} />
              <GapList title="Best-for surfaced" covered={gap?.bestForCovered ?? []} missing={gap?.bestForMissing ?? []} />
            </div>
          </div>
        ) : (
          <EmptyState
            title="Set your intended positioning and run checks"
            description="Once AI perception data exists, we'll score how closely it matches what you declared."
          />
        )}
      </Panel>

      {/* Evidence */}
      {evidence.length > 0 && (
        <Panel title="Evidence" description="Raw per-run perception behind the aggregate." className="lg:col-span-2">
          <div className="space-y-2">
            {evidence.slice(0, 12).map((row) => (
              <details key={row.id} className="rounded-md border border-line p-3">
                <summary className="cursor-pointer text-sm font-medium text-ink">
                  {row.perceived_category ?? "(no category)"} · <span className="text-muted">{TONE_LABEL[row.tone] ?? row.tone}</span>
                </summary>
                <div className="mt-2 space-y-1 text-sm text-muted">
                  {row.strengths?.length ? <p><b>Strengths:</b> {row.strengths.join(", ")}</p> : null}
                  {row.weaknesses?.length ? <p><b>Weaknesses:</b> {row.weaknesses.join(", ")}</p> : null}
                  {row.recommended_for?.length ? <p><b>Recommended for:</b> {row.recommended_for.join(", ")}</p> : null}
                </div>
              </details>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function emptyPosition(): Positioning {
  return {
    category: null,
    target_customer: null,
    differentiators: [],
    best_for: [],
    transformation_from: null,
    transformation_to: null,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function ChipField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  }
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="chip">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        className="input mt-2"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
      {values.length === 0 && <Plus className="hidden" />}
    </Field>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}

function CountList({ title, items }: { title: string; items: { value: string; count: number }[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 8).map((i) => (
          <span key={i.value} className="chip">
            {i.value} <span className="text-muted">×{i.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function GapList({ title, covered, missing }: { title: string; covered: string[]; missing: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="space-y-1 text-sm">
        {covered.map((c) => (
          <li key={c} className="text-ink">
            ✓ {c}
          </li>
        ))}
        {missing.map((m) => (
          <li key={m} className="text-muted">
            ✗ {m}
          </li>
        ))}
        {covered.length === 0 && missing.length === 0 && <li className="text-muted">—</li>}
      </ul>
    </div>
  );
}
