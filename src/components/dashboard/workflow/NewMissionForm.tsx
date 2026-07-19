"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

export default function NewMissionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [priority, setPriority] = useState(3);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/workflow/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, objective, priority }),
      });
      if (res.ok) {
        setTitle("");
        setObjective("");
        setPriority(3);
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New mission
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Mission title"
        className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <textarea
        value={objective}
        onChange={(e) => setObjective(e.target.value)}
        placeholder="Objective (optional)"
        rows={2}
        className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted">Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="rounded-lg border border-line px-2 py-1 text-sm"
        >
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !title.trim()} className="btn-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
