import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandFromSlug } from "@/lib/selected-brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/empty-state";
import CitationNetworkGraph from "@/app/dashboard/citation-network/CitationNetworkGraph";

type NetNode = {
  id: string;
  label: string;
  kind: "brand" | "prompt" | "source";
  sourceType?: "own" | "competitor" | "third";
  reach?: number;
};

type NetEdge = {
  from: string;
  to: string;
  engine: string;
  sourceType: "own" | "competitor" | "third";
};

export const dynamic = "force-dynamic";

export default async function CitationNetworkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandFromSlug(slug);
  if (!brand) notFound();

  const supabase = await createClient();
  const { data: prompts } = await supabase.from("prompts").select("id, text").eq("brand_id", brand.id);
  const promptIds = (prompts ?? []).map((p) => p.id);

  const { data: runs } = promptIds.length
    ? await supabase.from("visibility_runs").select("id, prompt_id, engines(name)").in("prompt_id", promptIds)
    : { data: [] as { id: string; prompt_id: string; engines: { name: string } | null }[] };

  const runIds = (runs ?? []).map((r) => r.id);

  const citationsResult = runIds.length
    ? await supabase
        .from("citations")
        .select("run_id, cited_domain, is_own_domain, is_competitor_domain")
        .in("run_id", runIds)
    : null;
  const citations = (citationsResult?.data ??
    []) as { run_id: string; cited_domain: string; is_own_domain: boolean; is_competitor_domain: boolean }[];

  if (runIds.length === 0 || citations.length === 0) {
    return (
      <div>
        <PageHeader
          title="Citation Network"
          subtitle={`Which sources form ${brand.name}'s citation ecosystem`}
        />
        <EmptyState
          icon={<span className="text-2xl">🕸️</span>}
          title="No citations yet"
          description="Run visibility checks across your prompts and engines first — the network builds itself from the sources AI engines actually cite."
        />
      </div>
    );
  }

  const runById = new Map((runs ?? []).map((r) => [r.id, r]));
  const promptById = new Map((prompts ?? []).map((p) => [p.id, p]));

  // Source reach = number of distinct prompts a domain is cited for. This is
  // the leverage signal: a domain cited across many of your prompts is a hub
  // worth pursuing a mention or listing on.
  const reachByDomain = new Map<string, Set<string>>();
  const sourceTypeByDomain = new Map<string, "own" | "competitor" | "third">();

  type EdgeKey = string;
  const edgeMap = new Map<EdgeKey, NetEdge>();
  const edges: NetEdge[] = [];

  for (const c of citations ?? []) {
    const run = runById.get(c.run_id);
    if (!run) continue;
    const prompt = promptById.get(run.prompt_id);
    if (!prompt) continue;
    const engine = Array.isArray(run.engines) ? run.engines[0] : run.engines;
    const engineName = engine?.name ?? "unknown";
    const sourceType: "own" | "competitor" | "third" = c.is_own_domain
      ? "own"
      : c.is_competitor_domain
        ? "competitor"
        : "third";

    if (!sourceTypeByDomain.has(c.cited_domain)) sourceTypeByDomain.set(c.cited_domain, sourceType);
    const set = reachByDomain.get(c.cited_domain) ?? new Set<string>();
    set.add(run.prompt_id);
    reachByDomain.set(c.cited_domain, set);

    const key = `${run.prompt_id}__${c.cited_domain}`;
    if (!edgeMap.has(key)) {
      const edge: NetEdge = {
        from: `p:${run.prompt_id}`,
        to: `s:${c.cited_domain}`,
        engine: engineName,
        sourceType,
      };
      edgeMap.set(key, edge);
      edges.push(edge);
    }
  }

  const nodes: NetNode[] = [
    { id: "brand", label: brand.name, kind: "brand" },
    ...(prompts ?? []).map((p) => ({ id: `p:${p.id}`, label: p.text, kind: "prompt" as const })),
    ...Array.from(reachByDomain.entries()).map(([domain, set]) => ({
      id: `s:${domain}`,
      label: domain,
      kind: "source" as const,
      sourceType: sourceTypeByDomain.get(domain)!,
      reach: set.size,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Citation Network"
        subtitle={`Which sources form ${brand.name}'s citation ecosystem — built only from citations AI engines actually returned.`}
      />
      <CitationNetworkGraph nodes={nodes} edges={edges} brandName={brand.name} />
    </div>
  );
}
