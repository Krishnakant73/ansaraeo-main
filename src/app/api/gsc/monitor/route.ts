import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getGscRefreshToken,
  getAccessToken,
  inspectUrl,
  listSitemaps,
  loadSnapshot,
  saveSnapshot,
  parseSitemapLocs,
  type IndexInspection,
} from "@/lib/gsc";

// POST /api/gsc/monitor — Body: { brandId, siteUrl?, limit? }
// Inspects index status for up to `limit` sitemap URLs via the URL
// Inspection API, flags pages that newly dropped from the index vs the
// last snapshot, and persists the new snapshot.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { brandId, siteUrl: siteUrlArg, limit } = await request.json();
    if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

    const refreshToken = await getGscRefreshToken(supabase, brandId);
    if (!refreshToken) return NextResponse.json({ error: "GSC not connected" }, { status: 400 });

    let siteUrl = siteUrlArg as string | undefined;
    if (!siteUrl) {
      const { data: brand } = await supabase.from("brands").select("domain").eq("id", brandId).single();
      if (brand?.domain) siteUrl = brand.domain.startsWith("http") ? brand.domain : `https://${brand.domain}`;
    }
    if (!siteUrl) return NextResponse.json({ error: "Brand has no domain" }, { status: 400 });

    const accessToken = await getAccessToken(refreshToken);
    const cap = Math.min(50, Math.max(1, Number(limit) || 20));

    const sitemaps = await listSitemaps(accessToken, siteUrl);
    if (!sitemaps.length) {
      return NextResponse.json({ result: { siteUrl, sitemapPath: null, inspected: [], deindexed: [], stats: { indexed: 0, notIndexed: 0, errors: 0 }, notes: ["No sitemaps submitted for this property in Search Console."] } });
    }

    // Fetch the first sitemap's XML and extract URLs to inspect.
    const first = sitemaps[0];
    const smRes = await fetch(first.path, { headers: { Authorization: `Bearer ${accessToken}` } });
    const smXml = smRes.ok ? await smRes.text() : "";
    const urls = parseSitemapLocs(smXml, cap);

    const prev = await loadSnapshot(supabase, brandId);
    const inspected: IndexInspection[] = [];
    for (const u of urls) {
      const r = await inspectUrl(accessToken, siteUrl, u);
      inspected.push(r);
    }
    await saveSnapshot(
      supabase,
      brandId,
      inspected.map((i) => ({ url: i.url, coverageState: i.coverageState }))
    );

    const deindexed = inspected
      .filter((i) => !i.indexed && prev.get(i.url) === "INDEXED")
      .map((i) => i.url);

    const stats = {
      indexed: inspected.filter((i) => i.indexed).length,
      notIndexed: inspected.filter((i) => !i.indexed && !i.error).length,
      errors: inspected.filter((i) => i.error).length,
    };

    return NextResponse.json({
      result: {
        siteUrl,
        sitemapPath: first.path,
        inspected,
        deindexed,
        stats,
        notes: [
          `Inspected ${inspected.length} of ${urls.length} sitemap URLs (capped at ${cap}). URL Inspection quota is ~2000/day per property.`,
          prev.size === 0 ? "First run — no de-index baseline yet; run again to detect drops." : `Compared against ${prev.size} prior snapshots.`,
        ],
      },
    });
  } catch (err) {
    console.error("gsc monitor error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "GSC monitor failed" }, { status: 500 });
  }
}
