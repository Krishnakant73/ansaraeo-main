"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";

export default function SecurityPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setMsg({ ok: false, text: "Password must be at least 6 characters." });
      return;
    }
    setSaving(true);
    setMsg(null);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    setPassword("");
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Password updated." });
  }

  async function signOutOthers() {
    setSigningOut(true);
    setMsg(null);
    const { error } = await createClient().auth.signOut({ scope: "others" });
    setSigningOut(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Signed out of other sessions." });
  }

  return (
    <div>
      <PageHeader title="Security" subtitle="Manage your account access" />
      <div className="mt-6 max-w-xl space-y-6">
        <Panel title="Account">
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted">Email</dt>
              <dd className="font-medium text-ink">{email || "—"}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Change password">
          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="section-label">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <button type="submit" disabled={saving} className="btn-primary !h-10 disabled:opacity-60">
              {saving ? "Updating…" : "Update password"}
            </button>
          </form>
        </Panel>

        <Panel title="Active sessions" description="Sign out every other device signed in to this account.">
          <button onClick={signOutOthers} disabled={signingOut} className="btn-ghost !h-10 disabled:opacity-60">
            {signingOut ? "Signing out…" : "Sign out other sessions"}
          </button>
        </Panel>

        {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-500"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
