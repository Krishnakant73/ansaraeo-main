// ============================================================
// brandScopedHref — resolve a "logical" module path against the
// current pathname so client components (Object panels, quick
// jumps, etc.) can link to `/dashboard/b/<slug>/<module>` without
// needing the slug threaded through as a prop.
//
// Extracts <slug> from the current URL when it's under
// `/dashboard/b/`; falls back to the legacy `/dashboard/<module>`
// path when it isn't (the redirect stubs there resolve the cookie's
// active brand and forward to the brand-scoped URL).
// ============================================================

export function brandScopedHref(pathname: string | null, moduleSuffix: string): string {
  if (pathname && pathname.startsWith("/dashboard/b/")) {
    const parts = pathname.split("/");
    // ["", "dashboard", "b", "<slug>", ...]
    const slug = parts[3];
    if (slug) return `/dashboard/b/${slug}${moduleSuffix}`;
  }
  return `/dashboard${moduleSuffix}`;
}
