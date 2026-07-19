"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Brandmark } from "@/components/shared/Brandmark";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="container-x relative flex min-h-screen items-center justify-center py-24">
      <Link
        href="/login"
        className="absolute left-5 top-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink md:left-8"
      >
        <ArrowLeft className="h-4 w-4" /> Back to login
      </Link>

      <div className="card w-full max-w-md p-8 hover:!translate-y-0 hover:!scale-100">
        <Brandmark className="mb-6 justify-center" />
        <h1 className="text-2xl font-extrabold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm text-muted">We&apos;ll email you a link to set a new one.</p>

        {sent ? (
          <p className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
            If an account exists for {email}, a reset link has been sent. Check your inbox and spam folder.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                placeholder="you@company.com"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
