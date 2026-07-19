"use client";

import { Menu, Search } from "lucide-react";
import BrandSwitcher from "@/app/dashboard/BrandSwitcher";
import type { Brand } from "@/lib/selected-brand";
import UserMenu from "./UserMenu";
import SearchBar from "./SearchBar";

export default function Topbar({
  brands,
  selectedBrandId,
  email,
  onMenu,
}: {
  brands: Brand[];
  selectedBrandId: string | null;
  email: string | null;
  onMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white/85 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-ink md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {brands.length > 1 && (
          <div className="hidden w-44 shrink-0 sm:block">
            <BrandSwitcher brands={brands} selectedBrandId={selectedBrandId} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SearchBar />
        <UserMenu email={email} />
      </div>
    </header>
  );
}
