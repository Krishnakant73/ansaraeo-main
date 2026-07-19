"use client";

import { useRouter } from "next/navigation";
import type { Brand } from "@/lib/selected-brand";

export default function BrandSwitcher({
  brands,
  selectedBrandId,
}: {
  brands: Brand[];
  selectedBrandId: string | null;
}) {
  const router = useRouter();

  if (brands.length <= 1) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    // Set a cookie so the server can read the selection on the next request
    document.cookie = `selected_brand_id=${e.target.value};path=/;max-age=${60 * 60 * 24 * 365}`;
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
