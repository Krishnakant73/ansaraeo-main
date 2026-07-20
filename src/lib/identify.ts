// Identify caller for GrowthBook / Vercel Flags SDK.
//
// Called once per request. `dedupe` (from `flags/next`) caches the result
// for the duration of a request so we don't hit Supabase Auth 12 times per
// render when a page checks multiple flags.
//
// The returned Attributes object is the input GrowthBook uses to evaluate
// each flag's targeting rules. Keep it lean — flag targeting reads a small
// number of dimensions (user id, plan, org, deviceType).

import type { Attributes } from "@flags-sdk/growthbook";
import type { Identify } from "flags";
import { dedupe } from "flags/next";
import { headers, cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const identify = dedupe(async (): Promise<Attributes> => {
  const [hdrs, ckies] = await Promise.all([headers(), cookies()]);
  const url = hdrs.get("x-forwarded-url") ?? hdrs.get("referer") ?? "";
  const host = hdrs.get("host") ?? "";
  const ua = hdrs.get("user-agent") ?? "";

  // Best-effort user resolution. When the caller is unauthenticated (marketing
  // pages, health checks), we still return a valid Attributes object so
  // GrowthBook can evaluate the "default when anonymous" rules cleanly.
  let userId = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? "";
  } catch {
    /* unauthenticated or Supabase unreachable — fall through with empty id */
  }

  // Anonymous device id from a cookie so flag assignment is stable across
  // page loads for logged-out users. If missing, GrowthBook still evaluates
  // rules against the empty string (matches "default variation" behavior).
  const deviceId = ckies.get("aeo_device_id")?.value ?? "";

  return {
    id: userId || deviceId,
    url,
    path: new URL(url || `http://${host}`).pathname,
    host,
    query: url.includes("?") ? url.split("?")[1] : "",
    deviceType: /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
    browser:
      /Firefox/i.test(ua) ? "firefox" :
      /Edg\//i.test(ua) ? "edge" :
      /Chrome/i.test(ua) ? "chrome" :
      /Safari/i.test(ua) ? "safari" : "other",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmTerm: "",
    utmContent: "",
  };
}) satisfies Identify<Attributes>;
