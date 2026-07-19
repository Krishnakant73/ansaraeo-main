"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WhatsAppConnect({ currentNumber, verified }: { currentNumber: string | null; verified: boolean }) {
  const router = useRouter();
  const [number, setNumber] = useState(currentNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/settings/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappNumber: number }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">WhatsApp</h3>
        {verified ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">Connected</span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Not verified</span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        Receive daily opportunity digests and approve drafts by replying APPROVE — no dashboard login needed.
      </p>
      <form onSubmit={handleSave} className="mt-4 flex gap-2">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="+91 98765 43210"
          className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button type="submit" disabled={saving} className="btn-secondary !h-auto disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {!verified && number && (
        <p className="mt-3 text-xs text-muted">
          After saving, an admin needs to mark this number verified once WhatsApp Business API access is approved for
          your account (see the setup guide — this isn&apos;t automatic yet at MVP stage).
        </p>
      )}
    </div>
  );
}
