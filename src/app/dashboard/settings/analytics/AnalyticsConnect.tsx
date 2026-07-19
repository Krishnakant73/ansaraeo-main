"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AnalyticsConnect({
  brandId,
  ga4Connected,
  shopifyConnected,
}: {
  brandId: string;
  ga4Connected: boolean;
  shopifyConnected: boolean;
}) {
  const router = useRouter();
  const [ga4PropertyId, setGa4PropertyId] = useState("");
  const [ga4Json, setGa4Json] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [shopToken, setShopToken] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveGA4(e: React.FormEvent) {
    e.preventDefault();
    setSaving("ga4");
    setError(null);
    const res = await fetch("/api/settings/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId,
        provider: "ga4",
        credentials: { propertyId: ga4PropertyId, serviceAccountJson: ga4Json },
      }),
    });
    const data = await res.json();
    setSaving(null);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    router.refresh();
  }

  async function saveShopify(e: React.FormEvent) {
    e.preventDefault();
    setSaving("shopify");
    setError(null);
    const res = await fetch("/api/settings/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId,
        provider: "shopify",
        credentials: { shopDomain, accessToken: shopToken },
      }),
    });
    const data = await res.json();
    setSaving(null);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Google Analytics 4</h3>
          {ga4Connected && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Connected</span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          Add your GA4 Property ID and a service account JSON key (added as &ldquo;Viewer&rdquo; on your GA4
          property — Admin → Property Access Management in Google Analytics).
        </p>
        <form onSubmit={saveGA4} className="mt-4 space-y-3">
          <input
            value={ga4PropertyId}
            onChange={(e) => setGa4PropertyId(e.target.value)}
            placeholder="GA4 Property ID (e.g. 123456789)"
            className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <textarea
            value={ga4Json}
            onChange={(e) => setGa4Json(e.target.value)}
            placeholder="Paste service account JSON key here"
            rows={4}
            className="w-full rounded-xl border border-line px-4 py-2.5 font-mono text-xs outline-none focus:border-accent"
          />
          <button type="submit" disabled={saving === "ga4"} className="btn-secondary !h-auto disabled:opacity-60">
            {saving === "ga4" ? "Saving…" : "Connect GA4"}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Shopify</h3>
          {shopifyConnected && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Connected</span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          Add your store domain and a private/custom app Admin API access token (Shopify Admin → Settings → Apps →
          Develop apps).
        </p>
        <form onSubmit={saveShopify} className="mt-4 space-y-3">
          <input
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            placeholder="yourstore.myshopify.com"
            className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <input
            value={shopToken}
            onChange={(e) => setShopToken(e.target.value)}
            placeholder="shpat_..."
            className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button type="submit" disabled={saving === "shopify"} className="btn-secondary !h-auto disabled:opacity-60">
            {saving === "shopify" ? "Saving…" : "Connect Shopify"}
          </button>
        </form>
      </div>
    </div>
  );
}
