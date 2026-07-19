"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Brand } from "@/lib/selected-brand";
import { NAV_GROUPS, isNavActive } from "./nav-config";
import Topbar from "./Topbar";

function Brandmark() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="AnsarAEO"
        className="h-8 w-8 rounded-lg object-cover"
      />
      <span className="text-lg font-extrabold tracking-tight text-ink">AnsarAEO</span>
    </Link>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="nav-group-label">{group.label}</p>
          {group.items.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn("nav-link", active && "nav-link-active")}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function DashboardShell({
  brands,
  selectedBrandId,
  email,
  children,
}: {
  brands: Brand[];
  selectedBrandId: string | null;
  email: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface app-gradient md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="p-4">
          <Brandmark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <NavContent />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-float">
            <div className="flex items-center justify-between p-4">
              <Brandmark />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              <NavContent onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          brands={brands}
          selectedBrandId={selectedBrandId}
          email={email}
          onMenu={() => setOpen(true)}
        />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
