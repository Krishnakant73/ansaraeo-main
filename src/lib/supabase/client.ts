// Supabase client for use in Client Components ("use client" files)
// Docs: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createBrowserClient } from "@supabase/ssr";

// Build-safe factory. Placeholder values are used ONLY when the env vars
// are missing at build time (Next.js static-prerenders "use client" pages,
// which triggers Supabase client construction; @supabase/ssr throws
// synchronously if URL/key aren't provided). The placeholders are never
// reachable at runtime — a real page load in the browser reads real env
// vars from the bundle. If they somehow are, auth calls will fail loudly
// against the placeholder host rather than falling through silently.
//
// Same lazy-safety spirit as getRazorpay() in src/lib/razorpay.ts — build
// must not require live credentials.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key-not-usable";
  return createBrowserClient(url, key);
}
