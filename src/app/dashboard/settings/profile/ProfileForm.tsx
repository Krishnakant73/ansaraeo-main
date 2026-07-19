"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Panel } from "@/components/dashboard/panel";

export default function ProfileForm({ email, initialName }: { email: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    setSaving(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Display name saved." });
  }

  return (
    <Panel title="Personal details" description="This is your login account, shared across every brand in your org.">
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="section-label">Email</label>
          <input
            value={email}
            disabled
            className="mt-1 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-muted"
          />
        </div>
        <div>
          <label className="section-label">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aanya Sharma"
            className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary !h-10 disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
          {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-500"}`}>{msg.text}</p>}
        </div>
      </form>
    </Panel>
  );
}
