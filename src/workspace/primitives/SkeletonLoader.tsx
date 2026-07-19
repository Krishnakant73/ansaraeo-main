import { cn } from "@/lib/utils";

// ============================================================
// SkeletonLoader — shared placeholder shapes for Suspense
// fallbacks across the workspace. Kept dependency-free (no ui/
// skeleton import) so it's usable from server components without
// pulling client CSS. Uses the animate-pulse token from Tailwind.
// ============================================================

export function SkeletonLine({
  width = "100%",
  className,
}: {
  width?: string | number;
  className?: string;
}) {
  return (
    <div
      style={{ width }}
      className={cn("h-3 animate-pulse rounded-full bg-surface", className)}
      aria-hidden
    />
  );
}

export function SkeletonBlock({
  height = 96,
  className,
}: {
  height?: number | string;
  className?: string;
}) {
  return (
    <div
      style={{ height }}
      className={cn("w-full animate-pulse rounded-2xl border border-line bg-surface", className)}
      aria-hidden
    />
  );
}

export function KpiSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBlock key={i} height={110} />
      ))}
    </div>
  );
}

export function TabBodySkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <SkeletonLine width={220} />
      <SkeletonBlock height={220} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonBlock height={120} />
        <SkeletonBlock height={120} />
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <SkeletonBlock height={140} />
      <SkeletonBlock height={90} />
      <SkeletonBlock height={90} />
    </div>
  );
}
