import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";
import type { ScanReport } from "@/lib/scan-classifier";
import { createRateLimiter } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

// ============================================================
// GET /api/share/[scanId] — 1200×630 shareable card as PNG.
//
// Used by celebration modals and share-view links. Reads the scan's
// canonical report and renders a fixed-layout card with the score,
// competitor comparison, and a short branded footer.
//
// Rate-limited per IP. Because next/og caches per URL by default and
// this endpoint is deterministic in its inputs, the API cost is
// bounded even under a viral share.
// ============================================================

export const runtime = "edge";

const shareLimit = createRateLimiter({ windowMs: 60_000, max: 60 });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const check = shareLimit(`share:${ip}`);
  if (!check.ok) {
    return new Response("Too many requests", { status: 429 });
  }

  const { scanId } = await params;
  const sb = createServiceClient();
  const { data: scan } = await sb
    .from("public_scans")
    .select("canonical_domain, report_json")
    .eq("id", scanId)
    .single();

  const report = (scan?.report_json as ScanReport | null) ?? null;
  const brandName = report?.brandName ?? scan?.canonical_domain ?? "Your brand";
  const score = report?.visibilityScore ?? 0;
  const competitor = report?.competitorScores[0];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg,#FFF7F1 0%,#FFFFFF 60%)",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#D66A38",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 800,
                fontSize: 24,
              }}
            >
              A
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1F2937" }}>AnsarAEO</div>
          </div>
          <div
            style={{
              marginTop: 40,
              fontSize: 28,
              color: "#6B7280",
              display: "flex",
            }}
          >
            AI Visibility · {brandName}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 84,
              fontWeight: 800,
              color: "#111827",
              letterSpacing: "-0.02em",
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            {score}
            <span style={{ fontSize: 36, color: "#6B7280", fontWeight: 600 }}>/100</span>
          </div>
          {competitor && (
            <div style={{ marginTop: 40, fontSize: 28, color: "#111827", display: "flex" }}>
              vs {competitor.name}: {competitor.rate}/100
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 20,
            color: "#6B7280",
          }}
        >
          <span>See where AI recommends your brand — ansaraeo.com</span>
          <span>{report?.totalAnswers ?? 0} AI answers analyzed</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
