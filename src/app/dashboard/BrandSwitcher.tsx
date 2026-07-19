"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Brand } from "@/lib/selected-brand";

export default function BrandSwitcher({
  brands,
  selectedBrandId,
}: {
  brands: Brand[];
  selectedBrandId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (brands.length <= 1) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextBrand = brands.find((b) => b.id === e.target.value);
    if (!nextBrand) return;

    // Cookie still gets written so unmigrated pages / API routes see the
    // change on the next request. The URL is the authoritative source for
    // migrated pages under /dashboard/b/[slug]/**.
    document.cookie = `selected_brand_id=${nextBrand.id};path=/;max-age=${60 * 60 * 24 * 365}`;

    // Rewrite the [slug] segment in place so the user stays on the same
    // sub-page (visibility, competitors, ...) rather than getting bounced
    // back to Mission Control every time they switch brands.
    if (pathname && pathname.startsWith("/dashboard/b/")) {
      const parts = pathname.split("/");
      // ["", "dashboard", "b", "<old-slug>", ...]
      parts[3] = nextBrand.slug;
      router.push(parts.join("/"));
      return;
    }

    // On any other path, land on the new brand's Mission Control.
    router.push(`/dashboard/b/${nextBrand.slug}`);
    router.refresh();
  }

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-muted">
        Active brand
      </label>
      <select
        value={selectedBrandId ?? ""}
        onChange={handleChange}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium outline-none focus:border-accent"
      >
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
