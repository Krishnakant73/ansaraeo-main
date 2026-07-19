import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAISessionsByDay, fetchRecentOrders } from "@/lib/revenue-attribution";
import { decryptCredentials } from "@/lib/crypto";

// GET /api/analytics/revenue?brandId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });

  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, credentials")
    .eq("brand_id", brandId)
    .eq("status", "connected");

  const ga4Row = integrations?.find((i) => i.provider === "ga4");
  const shopifyRow = integrations?.find((i) => i.provider === "shopify");

  if (!ga4Row && !shopifyRow) {
    return NextResponse.json({ error: "Connect GA4 and/or Shopify first in Settings → Analytics" }, { status: 400 });
  }

  try {
    // Decrypt each integration's credentials just before use — never
    // logged, never sent back to the client, only used server-side to
    // call GA4/Shopify's APIs.
    const ga4Credentials = ga4Row ? decryptCredentials<{ propertyId: string; serviceAccountJson: string }>(ga4Row.credentials.data) : null;
    const shopifyCredentials = shopifyRow
      ? decryptCredentials<{ shopDomain: string; accessToken: string }>(shopifyRow.credentials.data)
      : null;

    const [sessionsByDay, ordersByDay] = await Promise.all([
      ga4Credentials ? fetchAISessionsByDay(ga4Credentials) : Promise.resolve({} as Record<string, number>),
      shopifyCredentials
        ? fetchRecentOrders(shopifyCredentials)
        : Promise.resolve({} as Record<string, { orders: number; revenue: number }>),
    ]);

    const allDates = new Set([...Object.keys(sessionsByDay), ...Object.keys(ordersByDay)]);
    const combined = Array.from(allDates)
      .sort()
      .map((date) => ({
        date: `${date.slice(6, 8)}/${date.slice(4, 6)}`,
        aiSessions: sessionsByDay[date] ?? 0,
        orders: ordersByDay[date]?.orders ?? 0,
        revenue: ordersByDay[date]?.revenue ?? 0,
      }));

    const totals = combined.reduce(
      (acc, d) => ({
        aiSessions: acc.aiSessions + d.aiSessions,
        orders: acc.orders + d.orders,
        revenue: acc.revenue + d.revenue,
      }),
      { aiSessions: 0, orders: 0, revenue: 0 }
    );

    return NextResponse.json({ success: true, hasGA4: !!ga4Row, hasShopify: !!shopifyRow, daily: combined, totals });
  } catch (err) {
    console.error("revenue attribution error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
