"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import posthog from "posthog-js";
import type { Brand } from "@/lib/selected-brand";
import Topbar from "./Topbar";
import Breadcrumbs from "./Breadcrumbs";
import Shortcuts from "./Shortcuts";
import ObjectsRail from "./ObjectsRail";
import CommandPalette from "./CommandPalette";
import CopilotDock from "./CopilotDock";
import RecentObjectsTracker from "./RecentObjectsTracker";
import ShareLinkModal from "./ShareLinkModal.client";

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

// ============================================================
// DashboardShell — Phase 1 IA.
//
// Rail  = 8 objects + Recent + collapsible More.
// Topbar = brand switcher + ⌘K trigger + user menu.
// Body  = the workspace body.
// Dock  = Copilot on the right (desktop) or bottom sheet (mobile).
//
// The 10-group flat nav in nav-config.ts is retained ONLY for
// FEATURE_TO_NAV_HREFS gating and for the palette's `go` commands to
// hydrate against. Users no longer see it as chrome.
// ============================================================

export default function DashboardShell({
  brands,
  selectedBrandId,
  selectedBrandSlug,
  userId,
  email,
  hiddenHrefs,
  children,
}: {
  brands: Brand[];
  selectedBrandId: string | null;
  selectedBrandSlug: string | null;
  userId: string | null;
  email: string | null;
  hiddenHrefs?: string[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      posthog.identify(userId, { email: email ?? undefined });
    }
  }, [userId, email]);
  const hasBrand = !!selectedBrandId;
  const lockedFeatures = hiddenHrefs ?? [];

  return (
    <div className="min-h-screen bg-surface app-gradient md:flex">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="p-4">
          <Brandmark />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <ObjectsRail brandSlug={selectedBrandSlug} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-float">
            <div className="flex items-center justify-between p-4">
              <Brandmark />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-ink"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              <ObjectsRail brandSlug={selectedBrandSlug} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          brands={brands}
          selectedBrandId={selectedBrandId}
          email={email}
          onMenu={() => setDrawerOpen(true)}
        />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 xl:pr-[404px]">
          <Breadcrumbs />
          {children}
        </main>
      </div>

      {/* Command palette — mounted once, triggered via ⌘K or palette:open event */}
      <CommandPalette hasBrand={hasBrand} lockedFeatures={lockedFeatures} brandSlug={selectedBrandSlug} />

      {/* Copilot dock — always present, always context-aware */}
      <CopilotDock />

      {/* Share-link modal — subscribes to `<kind>:share-link` events dispatched
          by workspace quick-actions. Kept at shell level so any workspace
          can open it without wiring its own modal instance. */}
      <ShareLinkModal
        eventNames={[
          "competitor:share-link",
          "engine:share-link",
          "brand:share-link",
        ]}
      />

      {/* Keyboard shortcuts + help overlay */}
      <Shortcuts />

      {/* Server-back the ObjectsRail Recent list (phase 3) */}
      <RecentObjectsTracker />
    </div>
  );
}
