// ============================================================
// Fetches AI-referral session data from GA4's Data API, and order/revenue
// data from Shopify's Admin API, for a single brand's own connected
// accounts (not AnsarAEO's own analytics).
// ============================================================

const AI_REFERRAL_SOURCES = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "bard.google.com",
  "copilot.microsoft.com",
];

type GA4Credentials = {
  propertyId: string;
  // A GA4 service-account JSON key, pasted in by the brand owner after
  // adding that service account as a "Viewer" on their GA4 property —
  // this is the standard lightweight server-to-server auth pattern for
  // GA4's Data API, avoiding a full OAuth consent-screen flow.
  serviceAccountJson: string;
};

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const key = JSON.parse(serviceAccountJson);
  const jwt = await import("jsonwebtoken");

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.default.sign(
    {
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    },
    key.private_key,
    { algorithm: "RS256" }
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: token,
    }),
  });
  if (!res.ok) throw new Error(`Google token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function fetchAISessionsByDay(
  credentials: GA4Credentials,
  daysBack = 30
): Promise<Record<string, number>> {
  const accessToken = await getGoogleAccessToken(credentials.serviceAccountJson);

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${credentials.propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${daysBack}daysAgo`, endDate: "today" }],
        dimensions: [{ name: "date" }, { name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
      }),
    }
  );
  if (!res.ok) throw new Error(`GA4 API error: ${res.status} ${await res.text()}`);
  const data = await res.json();

  const byDay: Record<string, number> = {};
  for (const row of data.rows ?? []) {
    const date = row.dimensionValues[0].value; // YYYYMMDD
    const source = (row.dimensionValues[1].value as string).toLowerCase();
    const sessions = parseInt(row.metricValues[0].value, 10);
    if (AI_REFERRAL_SOURCES.some((s) => source.includes(s))) {
      byDay[date] = (byDay[date] ?? 0) + sessions;
    }
  }
  return byDay;
}

type ShopifyCredentials = { shopDomain: string; accessToken: string };

export async function fetchRecentOrders(credentials: ShopifyCredentials, daysBack = 30) {
  const sinceDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `https://${credentials.shopDomain}/admin/api/2024-10/orders.json?status=any&created_at_min=${sinceDate}&limit=250`,
    { headers: { "X-Shopify-Access-Token": credentials.accessToken } }
  );
  if (!res.ok) throw new Error(`Shopify API error: ${res.status} ${await res.text()}`);
  const data = await res.json();

  const byDay: Record<string, { orders: number; revenue: number }> = {};
  for (const order of data.orders ?? []) {
    const date = order.created_at.slice(0, 10).replace(/-/g, ""); // match GA4's YYYYMMDD format
    if (!byDay[date]) byDay[date] = { orders: 0, revenue: 0 };
    byDay[date].orders += 1;
    byDay[date].revenue += parseFloat(order.total_price);
  }
  return byDay;
}
