import { createClient } from "@/lib/supabase/server";
import HexRadar from "@/workspace/primitives/HexRadar";
import { EmptyStateCoach } from "@/workspace/primitives";
import { loadEngineDnaOverlay } from "@/lib/engine-dna";
import { DNA_AXES } from "@/lib/engine-dna";
import type { Engine } from "@/lib/engine-workspace";

// ============================================================
// AiDnaRadar — six-axis radial glyph comparing this engine's
// personality against the brand's cross-engine baseline.
//
// The overlay ("you") is the mean personality across every OTHER
// active engine for the same brand — the most actionable
// comparison a customer can act on. A big spike on any axis says
// "this engine is different from the pack in this dimension."
//
// Uses the shared HexRadar primitive.
// ============================================================

const RADAR_AXES = [
  { key: "verbosity", angle: -90 },
  { key: "hedging", angle: -30 },
  { key: "format_bias", angle: 30 },
  { key: "freshness_bias", angle: 90 },
  { key: "citation_density", angle: 150 },
  { key: "entity_resolution", angle: 210 },
] as const;

export default async function AiDnaRadar({ engine }: { engine: Engine }) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { them, you } = await loadEngineDnaOverlay(supabase as any, engine.id, engine.brand.id);
  const anyData = Object.values(them).some((v) => v > 0);
  if (!anyData) {
    return (
      <EmptyStateCoach
        title="No DNA yet"
        description={`Run visibility scans on ${engine.displayName} so we can chart its personality vs your cross-engine baseline.`}
        action={{
          label: "Run visibility scan",
          href: `/dashboard/b/${engine.brand.slug}/visibility`,
        }}
      />
    );
  }

  const axes = RADAR_AXES.map((a) => {
    const meta = DNA_AXES.find((x) => x.key === a.key)!;
    return {
      key: a.key,
      label: meta.label,
      angle: a.angle,
      href: `/dashboard/w/engine/${engine.name}/behavior`,
    };
  });

  // Top gap axis for the caption.
  const gaps = RADAR_AXES.map((a) => ({
    key: a.key,
    gap: (them[a.key] ?? 0) - (you[a.key] ?? 0),
  })).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const top = gaps[0];
  const topMeta = DNA_AXES.find((x) => x.key === top.key)!;
  const caption =
    top.gap > 0
      ? `${engine.displayName} scores ${Math.abs(top.gap).toFixed(0)} points higher than your average engine on ${topMeta.label.toLowerCase()}.`
      : top.gap < 0
        ? `${engine.displayName} scores ${Math.abs(top.gap).toFixed(0)} points lower than your average engine on ${topMeta.label.toLowerCase()}.`
        : `${engine.displayName} matches your cross-engine baseline.`;

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="section-label">AI DNA Radar</p>
        <span className="text-[11px] text-muted">{engine.displayName} · other engines</span>
      </div>
      <div className="mt-2">
        <HexRadar
          axes={axes}
          primary={them}
          overlay={you}
          primaryLabel={engine.displayName}
          overlayLabel="Other engines"
          caption={caption}
          ariaLabel={`Six-axis personality radar for ${engine.displayName} overlaid with the average of other engines`}
        />
      </div>
    </section>
  );
}
