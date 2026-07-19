"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, Check } from "lucide-react";

type Competitor = { id: string; name: string; confirmed: boolean; source: string };

export default function CompetitorsManager({ brandId, competitors }: { brandId: string; competitors: Competitor[] }) {
  const router = useRouter();
  const [discovering, setDiscovering] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const suggested = competitors.filter((c) => !c.confirmed);
  const confirmed = competitors.filter((c) => c.confirmed);

  async function discover() {
    setDiscovering(true);
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
              <div key={c.id} className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 py-1.5 pl-4 pr-2 text-sm">
                {c.name}
                <button onClick={() => respondTo(c.id, "confirm")} className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-3 w-3" />
                </button>
                <button onClick={() => respondTo(c.id, "reject")} className="grid h-5 w-5 place-items-center rounded-full bg-red-400 text-white">
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
            <span key={c.id} className="rounded-full bg-grid px-4 py-1.5 text-sm font-medium">
              {c.name}
            </span>
          ))}
          {confirmed.length === 0 && <p className="text-sm text-muted">No competitors confirmed yet.</p>}
        </div>
      </div>
    </div>
  );
}
