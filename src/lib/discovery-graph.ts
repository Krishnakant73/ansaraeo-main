// ============================================================
// discovery-graph.ts — L2 AI Discovery Graph + Citation Graph.
//
// The proprietary network-effect moat. Every visibility_run we already
// capture (mentions, citations, competitors, prompt intents) is turned into
// weighted edges between entities (brands, sources, topics, competitors).
// No new LLM/API calls: the graph bootstraps for free from data the pipeline
// already produces. Deeper topic/entity extraction from raw_response text is
// a later enhancement (would require an LLM pass) and is NOT faked here.
//
// Two layers, like benchmark-engine:
//   - PURE math (pageRank, normalizeEntityKey, accumulateEdges) — tested, no IO.
//   - IO (extractGraphFromRuns, computeGraphMetrics) — service client, cron.
//
// Edge semantics (subject → predicate → object):
//   source(domain) -[CITES]-> brand             AI answer cited the brand's own domain
//   brand -[MENTIONS]-> topic(intent/category)  brand surfaced for a topic
//   brand -[COMPETES_WITH]-> competitor         competitor named in same answer
//   source(domain) -[TOPIC_OF]-> topic          domain cited for a topic
//   brand -[APPEARS_IN_ENGINE]-> engine          brand mentioned on an engine
// ============================================================

import { createServiceClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/monitoring";

export const ENTITY_TYPES = ["brand", "source", "topic", "person", "product", "org", "location"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const PREDICATES = [
  "CITES",
  "MENTIONS",
  "RECOMMENDS",
  "COMPETES_WITH",
  "TOPIC_OF",
  "AUTHOR_OF",
  "SCHEMA_FOR",
  "APPEARS_IN_ENGINE",
] as const;
export type Predicate = (typeof PREDICATES)[number];

// ---------- PURE math ----------

/** Canonical, dedup-safe entity key: lowercased, punctuation stripped, whitespace collapsed. */
export function normalizeEntityKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type GraphEdge = { from: string; to: string; weight: number };

/**
 * Accumulate weighted, directed edges into an adjacency map keyed by node.
 * Pure: same input → same map. Used by the materializer to feed PageRank.
 */
export function accumulateEdges(edges: GraphEdge[]): Map<string, Map<string, number>> {
  const adj = new Map<string, Map<string, number>>();
  for (const e of edges) {
    if (!e.from || !e.to || e.from === e.to) continue;
    if (!adj.has(e.from)) adj.set(e.from, new Map());
    const m = adj.get(e.from)!;
    m.set(e.to, (m.get(e.to) ?? 0) + e.weight);
  }
  return adj;
}

/**
 * PageRank over a directed weighted graph. Deterministic, no RNG.
 * `nodes` seeds the set (so isolated nodes still get a rank); `edges` are
 * from→to with positive weights. Dangling nodes (no out-edges) redistribute
 * their rank uniformly (standard PageRank teleport complement). Returns a
 * node→score map normalized to sum to 1.
 */
export function pageRank(
  nodes: string[],
  edges: GraphEdge[],
  opts: { damping?: number; iterations?: number; tol?: number } = {},
): Map<string, number> {
  const damping = opts.damping ?? 0.85;
  const iterations = opts.iterations ?? 40;
  const tol = opts.tol ?? 1e-9;
  const adj = accumulateEdges(edges);
  const all = new Set<string>(nodes);
  for (const e of edges) {
    all.add(e.from);
    all.add(e.to);
  }
  const nodeList = [...all];
  const n = nodeList.length;
  const rank = new Map<string, number>();
  for (const node of nodeList) rank.set(node, 1 / Math.max(1, n));

  const outWeightSum = new Map<string, number>();
  for (const [from, m] of adj) {
    let s = 0;
    for (const w of m.values()) s += w;
    outWeightSum.set(from, s);
  }

  for (let it = 0; it < iterations; it++) {
    // dangling mass: sum of ranks of nodes with no out-edges
    let dangling = 0;
    for (const node of nodeList) {
      if (!adj.has(node) || (outWeightSum.get(node) ?? 0) === 0) dangling += rank.get(node) ?? 0;
    }
    const next = new Map<string, number>();
    let maxDelta = 0;
    for (const node of nodeList) {
      // teleport + dangling redistribution
      let sum = (1 - damping + damping * dangling) / Math.max(1, n);
      // contribution from inbound edges
      for (const from of nodeList) {
        const m = adj.get(from);
        if (!m) continue;
        const w = m.get(node);
        if (!w) continue;
        const ow = outWeightSum.get(from) ?? 0;
        if (ow > 0) sum += (damping * (rank.get(from) ?? 0) * w) / ow;
      }
      next.set(node, sum);
      maxDelta = Math.max(maxDelta, Math.abs((sum - (rank.get(node) ?? 0))));
    }
    for (const [k, v] of next) rank.set(k, v);
    if (maxDelta < tol) break;
  }

  // Normalize to sum 1 (defensive; math already tends there).
  let total = 0;
  for (const v of rank.values()) total += v;
  if (total > 0) for (const [k, v] of rank) rank.set(k, v / total);
  return rank;
}

/** In/out degree from an edge list. Pure. */
export function degrees(edges: GraphEdge[]): { inDegree: Map<string, number>; outDegree: Map<string, number> } {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const e of edges) {
    outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }
  return { inDegree, outDegree };
}

// ---------- IO layer ----------

const GRAPH_BATCH = 500;

type RunRow = {
  id: string;
  brand_mentioned: boolean | null;
  recommendation_alignment: string | null;
  competitor_mentions: { name: string; mentioned: boolean }[] | null;
  prompts: { brand_id: string; brands: { name: string; domain: string | null } | null; intent: string | null; category: string | null; text: string } | null;
  engines: { name: string } | null;
  citations: { cited_domain: string; is_own_domain: boolean }[] | null;
};

function svc() {
  return createServiceClient();
}

/**
 * Extract the discovery graph from all visibility_runs + citations.
 * Failure-isolated per concern; a citation error never blocks edge writes.
 * Returns counts of entities/sources/edges upserted for the cron log.
 */
export async function extractGraphFromRuns(opts: { from?: string; to?: string } = {}): Promise<{
  brands: number;
  sources: number;
  edges: number;
}> {
  const supabase = svc();

  let q = supabase
    .from("visibility_runs")
    .select(
      "id, brand_mentioned, recommendation_alignment, competitor_mentions, engines(name), prompts!inner(brand_id, intent, category, text, brands(name, domain))",
    )
    .eq("skipped", false);
  if (opts.from) q = q.gte("run_at", opts.from);
  if (opts.to) q = q.lte("run_at", opts.to);
  q = q.limit(GRAPH_BATCH);
  const { data: runs, error } = await q;
  if (error) throw error;

  const runRows = (runs ?? []) as unknown as RunRow[];
  if (runRows.length === 0) return { brands: 0, sources: 0, edges: 0 };

  const runIds = runRows.map((r) => r.id);
  const { data: cites } = await supabase
    .from("citations")
    .select("run_id, cited_domain, is_own_domain")
    .in("run_id", runIds);
  const citesByRun = new Map<string, { cited_domain: string; is_own_domain: boolean }[]>();
  for (const c of (cites ?? []) as any[]) {
    if (!citesByRun.has(c.run_id)) citesByRun.set(c.run_id, []);
    citesByRun.get(c.run_id)!.push({ cited_domain: c.cited_domain, is_own_domain: c.is_own_domain });
  }

  const now = new Date().toISOString();
  const entities = new Map<string, { type: EntityType; name: string }>();
  const sources = new Map<string, { authority_score: number | null; is_trusted_source: boolean }>();
  const edgeKeys = new Set<string>();
  const edgeRows: any[] = [];

  const upsertEntity = (type: EntityType, name: string) => {
    const key = normalizeEntityKey(name);
    if (!entities.has(`${type}:${key}`)) entities.set(`${type}:${key}`, { type, name });
    return { type, key };
  };

  for (const run of runRows) {
    const prompt = run.prompts;
    if (!prompt || !prompt.brands) continue;
    const brandName = prompt.brands.name;
    const brandKey = upsertEntity("brand", brandName).key;
    const engineName = run.engines?.name ?? "unknown";
    const topic = prompt.category || prompt.intent || "general";
    const topicKey = upsertEntity("topic", topic).key;
    const industry = normalizeEntityKey(prompt.intent || "other");

    // brand -[MENTIONS]-> topic  (brand surfaced for a topic)
    if (run.brand_mentioned) {
      addEdge(edgeRows, edgeKeys, "brand", brandKey, "MENTIONS", "topic", topicKey, 1, engineName, industry);
    }
    // brand -[APPEARS_IN_ENGINE]-> engine
    addEdge(edgeRows, edgeKeys, "brand", brandKey, "APPEARS_IN_ENGINE", "engine", engineName, run.brand_mentioned ? 1 : 0.2, engineName, industry);
    // brand -[RECOMMENDS] when alignment aligned
    if (run.recommendation_alignment === "aligned") {
      addEdge(edgeRows, edgeKeys, "brand", brandKey, "RECOMMENDS", "topic", topicKey, 1, engineName, industry);
    }
    // brand -[COMPETES_WITH]-> competitor
    for (const cm of run.competitor_mentions ?? []) {
      if (cm.mentioned && cm.name) {
        const compKey = upsertEntity("brand", cm.name).key;
        addEdge(edgeRows, edgeKeys, "brand", brandKey, "COMPETES_WITH", "brand", compKey, 1, engineName, industry);
      }
    }
    // citations: own domain cited → source -[CITES]-> brand ; topic edge source -[TOPIC_OF]-> topic
    for (const c of citesByRun.get(run.id) ?? []) {
      if (!c.cited_domain) continue;
      const dom = c.cited_domain;
      const srcKey = upsertEntity("source", dom).key;
      if (!sources.has(dom)) sources.set(dom, { authority_score: null, is_trusted_source: false });
      if (c.is_own_domain && run.brand_mentioned) {
        // AI answer cited the brand's own domain while mentioning the brand → strong recommendation signal
        addEdge(edgeRows, edgeKeys, "source", srcKey, "CITES", "brand", brandKey, 1, engineName, industry);
      }
      addEdge(edgeRows, edgeKeys, "source", srcKey, "TOPIC_OF", "topic", topicKey, 0.5, engineName, industry);
    }
  }

  // Write entities (brand/topic/source) — conflict on (type, normalized_key) ignores dupes.
  if (entities.size > 0) {
    await supabase.from("entities").upsert(
      [...entities.values()].map((e) => ({
        entity_type: e.type,
        name: e.name,
        normalized_key: normalizeEntityKey(e.name),
        last_seen: now,
      })),
      { onConflict: "entity_type,normalized_key", ignoreDuplicates: true },
    );
  }
  if (sources.size > 0) {
    await supabase.from("sources").upsert(
      [...sources.keys()].map((d) => ({ domain: d, citation_count: 1, last_seen: now })),
      { onConflict: "domain", ignoreDuplicates: true },
    );
  }
  if (edgeRows.length > 0) {
    await supabase.from("discovery_edges").upsert(edgeRows, {
      onConflict: "subject_type,subject_key,predicate,object_type,object_key,industry_category",
    });
  }

  return { brands: [...entities.keys()].filter((k) => k.startsWith("brand:")).length, sources: sources.size, edges: edgeRows.length };
}

function addEdge(
  rows: any[],
  seen: Set<string>,
  subjectType: string,
  subjectKey: string,
  predicate: Predicate,
  objectType: string,
  objectKey: string,
  weight: number,
  engine: string,
  industry: string,
) {
  const key = `${subjectType}|${subjectKey}|${predicate}|${objectType}|${objectKey}|${industry}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({
    subject_type: subjectType,
    subject_key: subjectKey,
    predicate,
    object_type: objectType,
    object_key: objectKey,
    weight,
    observation_count: 1,
    confidence: 1,
    engines: JSON.stringify([engine]),
    industry_category: industry,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
  });
}

/**
 * Materialize node metrics (PageRank + degrees) from discovery_edges.
 * Runs in cron, not per-request. Loads edges, builds the pure graph, writes
 * graph_metrics idempotently.
 */
export async function computeGraphMetrics(): Promise<{ nodes: number }> {
  const supabase = svc();
  const { data: edges, error } = await supabase
    .from("discovery_edges")
    .select("subject_type, subject_key, predicate, object_type, object_key, weight");
  if (error) throw error;
  const eRows = (edges ?? []) as any[];

  const graphEdges: GraphEdge[] = eRows.map((e) => ({
    from: `${e.subject_type}:${e.subject_key}`,
    to: `${e.object_type}:${e.object_key}`,
    weight: Number(e.weight) || 0,
  }));

  const { inDegree, outDegree } = degrees(graphEdges);
  const pr = pageRank([], graphEdges);

  const nodeKeys = new Set<string>([...inDegree.keys(), ...outDegree.keys(), ...pr.keys()]);
  const rows = [...nodeKeys].map((node) => {
    const [entityType, ...rest] = node.split(":");
    return {
      entity_type: entityType,
      entity_key: rest.join(":"),
      pagerank: (pr.get(node) ?? 0).toFixed(8),
      in_degree: inDegree.get(node) ?? 0,
      out_degree: outDegree.get(node) ?? 0,
      computed_at: new Date().toISOString(),
    };
  });

  if (rows.length > 0) {
    const { error: upsertErr } = await supabase.from("graph_metrics").upsert(rows, {
      onConflict: "entity_type,entity_key",
    });
    if (upsertErr) throw upsertErr;
  }
  return { nodes: rows.length };
}

/** Failure-isolated wrappers for cron. */
export async function safeExtractGraph(opts: { from?: string; to?: string } = {}): Promise<void> {
  try {
    await extractGraphFromRuns(opts);
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("graph extract failed"), { context: "extractGraphFromRuns" });
  }
}

export async function safeComputeGraphMetrics(): Promise<void> {
  try {
    await computeGraphMetrics();
  } catch (err) {
    reportError(err instanceof Error ? err : new Error("graph metrics failed"), { context: "computeGraphMetrics" });
  }
}
