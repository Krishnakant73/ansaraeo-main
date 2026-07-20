"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Check } from "lucide-react";
import posthog from "posthog-js";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
} from "@/components/ui/sheet";
import CompetitorPanel from "@/components/dashboard/objects/CompetitorPanel";

type Competitor = { id: string; name: string; confirmed: boolean; source: string };

export default function CompetitorsManager({
  brandId,
  competitors,
  shareOfVoice = {},
}: {
  brandId: string;
  competitors: Competitor[];
  shareOfVoice?: Record<string, number>;
}) {
  const router = useRouter();
  const [discovering, setDiscovering] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const suggested = competitors.filter((c) => !c.confirmed);
  const confirmed = competitors.filter((c) => c.confirmed);

  async function discover() {
    setDiscovering(true);
    posthog.capture("competitor_auto_discover_clicked", { brand_id: brandId });
    const res = await fetch("/api/competitors/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    const data = await res.json();
    setDiscovering(false);
    if (!res.ok) {
      alert(data.error);
      return;
    }
    router.refresh();
  }

  async function respondTo(competitorId: string, action: "confirm" | "reject") {
    if (action === "confirm") {
      posthog.capture("competitor_confirmed", { competitor_id: competitorId, brand_id: brandId });
    }
    await fetch(`/api/competitors/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorId }),
    });
    router.refresh();
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, name: newName }),
    });
    posthog.capture("competitor_added", { brand_id: brandId });
    setAdding(false);
    setNewName("");
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={discover} disabled={discovering} className="btn-secondary !h-10 disabled:opacity-60">
          <Sparkles className="mr-1.5 h-4 w-4 text-accent" />
          {discovering ? "Finding competitors…" : "Auto-discover competitors"}
        </button>
        <form onSubmit={addManual} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Or add one manually"
            className="rounded-full border border-line px-4 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="submit" disabled={adding} className="btn-secondary !h-auto !px-4 disabled:opacity-60">
            Add
          </button>
        </form>
      </div>

      {suggested.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            AI-suggested — review before tracking
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggested.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 py-1.5 pl-1 pr-2 text-sm">
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      className="rounded-full px-3 py-0.5 font-medium text-ink outline-none transition-colors hover:text-accent focus-visible:text-accent"
                      title="Peek competitor"
                    >
                      {c.name}
                    </button>
                  </SheetTrigger>
                  <SheetContent>
                    <CompetitorPanel competitor={c} shareOfVoice={shareOfVoice[c.name]} />
                  </SheetContent>
                </Sheet>
                <a
                  href={`/dashboard/w/competitor/${c.id}/overview`}
                  className="rounded-full px-1 text-xs text-muted hover:text-accent"
                  title="Open workspace"
                >
                  ↗
                </a>
                <button
                  onClick={() => respondTo(c.id, "confirm")}
                  aria-label={`Confirm ${c.name} as a competitor`}
                  title="Confirm"
                  className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => respondTo(c.id, "reject")}
                  aria-label={`Reject ${c.name} as a competitor`}
                  title="Reject"
                  className="grid h-5 w-5 place-items-center rounded-full bg-red-400 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tracking</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {confirmed.map((c) => (
            <div key={c.id} className="flex items-center gap-1 rounded-full bg-grid pr-2">
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    className="rounded-full px-4 py-1.5 text-sm font-medium text-ink outline-none transition-colors hover:text-accent focus-visible:text-accent"
                    title="Peek competitor"
                  >
                    {c.name}
                  </button>
                </SheetTrigger>
                <SheetContent>
                  <CompetitorPanel competitor={c} shareOfVoice={shareOfVoice[c.name]} />
                </SheetContent>
              </Sheet>
              <a
                href={`/dashboard/w/competitor/${c.id}/overview`}
                className="text-xs text-muted hover:text-accent"
                title="Open workspace"
              >
                ↗
              </a>
            </div>
          ))}
          {confirmed.length === 0 && <p className="text-sm text-muted">No competitors confirmed yet.</p>}
        </div>
      </div>
    </div>
  );
}
