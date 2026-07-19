// ============================================================
// Business-outcome layer (the "outcome" third of visibility -> quality ->
// outcome). Reads the brand's OWN connected GA4 + Shopify accounts (never
// AnsarAEO's) and merges AI-referral sessions with orders/revenue by day.
//
// Honesty: this only returns data when the brand has actually connected
// GA4/Shopify integrations. If nothing is connected (or a fetch fails), it
// reports `connected: false` and the dashboard shows a "connect to see ROI"
// state instead of fabricating numbers.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAISessionsByDay, fetchRecentOrders } from "./revenue-attribution";

export type RevenueOutcome = {
  connected: boolean;
  aiSessions: number | null;
  assistedRevenue: number | null;
  orders: number | null;
  error?: string;
};

export async function getRevenueOutcome(
  brandId: string,
  supabase: SupabaseClient,
): Promise<RevenueOutcome> {
  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, credentials")
    .eq("brand_id", brandId);

  const ga4 = (integrations ?? []).find((i) => i.provider === "ga4");
  const shopify = (integrations ?? []).find((i) => i.provider === "shopify");

  if (!ga4 && !shopify) return { connected: false, aiSessions: null, assistedRevenue: null, orders: null };

  let aiSessions: number | null = null;
  let assistedRevenue: number | null = null;
  let orders: number | null = null;
  let error: string | undefined;

  try {
    if (ga4) {
      const creds = ga4.credentials as { propertyId: string; serviceAccountJson: string };
      const byDay = await fetchAISessionsByDay(
        { propertyId: creds.propertyId, serviceAccountJson: creds.serviceAccountJson },
        30,
      );
      aiSessions = Object.values(byDay).reduce((a, b) => a + b, 0);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "GA4 fetch failed";
  }

  try {
    if (shopify) {
      const creds = shopify.credentials as { shopDomain: string; accessToken: string };
      const byDay = await fetchRecentOrders(
        { shopDomain: creds.shopDomain, accessToken: creds.accessToken },
        30,
      );
      assistedRevenue = Object.values(byDay).reduce((a, b) => a + b.revenue, 0);
      orders = Object.values(byDay).reduce((a, b) => a + b.orders, 0);
    }
  } catch (e) {
    error = error ?? (e instanceof Error ? e.message : "Shopify fetch failed");
  }

  return {
    connected: true,
    aiSessions,
    assistedRevenue,
    orders,
    error,
  };
}
