// ============================================================
// /api/v1/intelligence — Versioned Intelligence API (Module 10).
//
// Public, anonymous kinds (benchmark | trend | ranking | market-share | feed)
// read ONLY published, k-anon-safe rows via the SERVICE client. We never
// return brand_id or raw text from these endpoints — the warehouse's privacy
// gate is enforced here, not just in SQL.
//
// Brand-scoped kinds (your-position | opportunities | forecast) require an
// authenticated session (cookie client + getSelectedBrand) and are RLS-scoped
// to the user's org.
//
// Stable JSON contract. Add kinds, never rename response fields in place.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSelectedBrand } from "@/lib/selected-brand";
import { getPublicFeed } from "@/lib/intelligence-feed";
import { getMarketShare } from "@/lib/brand-rankings";
// (benchmark_aggregates / rankings / trends are read directly via the service
// client to enforce the published-only gate in one place.)

export const dynamic = "force-dynamic";

function bucket(period?: string | null): string {
  // default to current month start
  if (period) return period.length >= 7 ? `${period.slice(0, 7)}-01` : period;
  return new Date().toISOString().slice(0, 7) + "-01";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "benchmark";

  try {
    // ---------- PUBLIC, published-only kinds ----------
    if (["benchmark", "trend", "ranking", "market-share", "feed"].includes(kind)) {
      const svc = createServiceClient();
      const period = bucket(searchParams.get("period"));

      if (kind === "benchmark") {
        const dimensionType = searchParams.get("dimension_type") ?? "industry";
        const dimensionValue = searchParams.get("dimension_value") ?? "all";
        const metric = searchParams.get("metric") ?? "avg_visibility";
        const { data, error } = await svc
          .from("benchmark_aggregates")
          .select("*")
          .eq("dimension_type", dimensionType)
          .eq("dimension_value", dimensionValue)
          .eq("metric", metric)
          .eq("published", true)
          .order("period_start", { ascending: false })
          .limit(24);
        if (error) throw error;
        return NextResponse.json({ kind, dimension_type: dimensionType, dimension_value: dimensionValue, metric, cells: data ?? [] });
      }

      if (kind === "trend") {
        const dimensionType = searchParams.get("dimension_type") ?? "industry";
        const dimensionValue = searchParams.get("dimension_value") ?? "all";
        const metric = searchParams.get("metric") ?? "avg_visibility";
        const { data, error } = await svc
          .from("benchmark_trend_cells")
          .select("*")
          .eq("dimension_type", dimensionType)
          .eq("dimension_value", dimensionValue)
          .eq("metric", metric)
          .order("period_start", { ascending: false })
          .limit(24);
        if (error) throw error;
        return NextResponse.json({ kind, dimension_type: dimensionType, dimension_value: dimensionValue, metric, cells: data ?? [] });
      }

      if (kind === "ranking") {
        const industry = searchParams.get("industry") ?? "saas";
        const metric = searchParams.get("metric") ?? "mention_rate";
        const { data, error } = await svc
          .from("rankings_monthly")
          .select("brand_token, value, percentile, rank")
          .eq("dimension_type", "industry")
          .eq("dimension_value", industry)
          .eq("rank_metric", metric)
          .eq("published", true)
          .order("rank", { ascending: true })
          .limit(100);
        if (error) throw error;
        return NextResponse.json({ kind, industry, metric, rankings: data ?? [] });
      }

      if (kind === "market-share") {
        const industry = searchParams.get("industry") ?? "saas";
        const share = await getMarketShare(industry);
        return NextResponse.json({ kind, ...share });
      }

      if (kind === "feed") {
        const scope = (searchParams.get("scope") as "global" | "industry") ?? "global";
        const industry = searchParams.get("industry") ?? undefined;
        const engine = searchParams.get("engine") ?? undefined;
        const feed = await getPublicFeed({ scope, industry, engine, limit: Number(searchParams.get("limit") ?? 50) });
        return NextResponse.json({ kind, scope, items: feed });
      }
    }

    // ---------- BRAND-SCOPED kinds (auth required) ----------
    const cookie = await createClient();
    const { brand, allBrands } = await getSelectedBrand();
    if (!brand) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    if (kind === "your-position") {
      const dimensionType = searchParams.get("dimension_type") ?? "industry";
      const dimensionValue = searchParams.get("dimension_value") ?? brand.industry ?? "other";
      const metric = searchParams.get("metric") ?? "avg_visibility";
      const period = bucket(searchParams.get("period"));
      const { data, error } = await cookie
        .from("benchmark_aggregates")
        .select("*")
        .eq("dimension_type", dimensionType)
        .eq("dimension_value", dimensionValue)
        .eq("metric", metric)
        .eq("published", true)
        .order("period_start", { ascending: false })
        .limit(1);
      const { data: own } = await cookie
        .from("benchmark_brand_snapshots")
        .select("mention_rate, citation_rate, avg_position, avg_trust, avg_visibility")
        .eq("brand_id", brand.id)
        .eq("engine", "*")
        .eq("intent", "*")
        .eq("language", "*")
        .order("period_start", { ascending: false })
        .limit(1);
      if (error) throw error;
      return NextResponse.json({
        kind,
        brand: brand.name,
        dimension_type: dimensionType,
        dimension_value: dimensionValue,
        metric,
        benchmark: (data && data[0]) ?? null,
        your_value: own && own[0] ? (own[0] as any)[metric] : null,
      });
    }

    if (kind === "opportunities") {
      const { data, error } = await cookie
        .from("opportunity_recommendations")
        .select("*")
        .eq("brand_id", brand.id)
        .neq("status", "dismissed")
        .order("priority_score", { ascending: false })
        .limit(50);
      if (error) throw error;
      return NextResponse.json({ kind, brand: brand.name, opportunities: data ?? [] });
    }

    if (kind === "forecast") {
      const metric = searchParams.get("metric") ?? "avg_visibility";
      const { data, error } = await cookie
        .from("forecast_runs")
        .select("*")
        .eq("scope", "brand")
        .eq("brand_id", brand.id)
        .eq("metric", metric)
        .order("generated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return NextResponse.json({ kind, brand: brand.name, metric, forecast: (data && data[0]) ?? null });
    }

    return NextResponse.json({ error: "unknown kind", hint: "benchmark|trend|ranking|market-share|feed|your-position|opportunities|forecast" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "internal_error", detail: err instanceof Error ? err.message : "unknown" }, { status: 500 });
  }
}
