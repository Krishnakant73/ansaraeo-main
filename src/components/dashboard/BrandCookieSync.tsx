"use client";

import { useEffect } from "react";

// ============================================================
// BrandCookieSync — Phase 2 bridge between URL-scoped pages
// (/dashboard/b/[slug]/**) and cookie-scoped pages (everything else).
//
// The URL is the source of truth for which brand is active. But 33
// module pages under /dashboard/** and every /api/** route still read
// `selected_brand_id` from the cookie. This client component runs on
// mount whenever the resolved brand id differs from the current cookie,
// keeping the two in sync so a subsequent nav to a cookie-scoped page
// finds the correct brand.
//
// A Server Component can't call cookies().set() outside Server Actions
// and Route Handlers, so this has to happen browser-side via document.cookie.
// ============================================================

function readSelected(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)selected_brand_id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function BrandCookieSync({ brandId }: { brandId: string }) {
  useEffect(() => {
    if (readSelected() === brandId) return;
    // 1 year, path-wide — same shape as BrandSwitcher writes today.
    document.cookie = `selected_brand_id=${encodeURIComponent(brandId)};path=/;max-age=${60 * 60 * 24 * 365}`;
  }, [brandId]);

  return null;
}
