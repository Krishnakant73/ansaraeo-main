"use client";

import { useRouter } from "next/navigation";

// Switches the active brand by writing the `selected_brand_id` cookie the
// server reads in getSelectedBrand(), then refreshes server components.
export default function SwitchBrandButton({
  brandId,
  name,
}: {
  brandId: string;
  name: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-xs btn-xs-accent"
      onClick={() => {
        document.cookie = `selected_brand_id=${brandId}; path=/; max-age=31536000`;
        router.refresh();
      }}
    >
      Switch to {name}
    </button>
  );
}
