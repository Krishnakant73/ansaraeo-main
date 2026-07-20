"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Brandmark } from "@/components/shared/Brandmark";
import posthog from "posthog-js";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    if (!agreedToTerms) {
      setError("You must agree to the Terms & Conditions and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { company_name: companyName, terms_accepted_at: new Date().toISOString() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    posthog.capture("user_signed_up", {
      method: "email",
      company_name: companyName,
    });
    router.push("/signup/check-email");
  }

  async function handleGoogleSignup() {
    if (!agreedToTerms) {
      setError("Please agree to the Terms & Conditions and Privacy Policy first.");
      return;
    }
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    } else {
      posthog.capture("user_signed_up", { method: "google" });
    }
  }

  return (
    <div className="container-x relative flex min-h-screen items-center justify-center py-24">
      <Link
        href="/"
        className="absolute left-5 top-8 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink md:left-8"
      >
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>

      <div className="card w-full max-w-md p-8 hover:!translate-y-0 hover:!scale-100">
        <Brandmark className="mb-6 justify-center" />
        <h1 className="text-2xl font-extrabold tracking-tight">Start your free trial</h1>
        <p className="mt-2 text-sm text-muted">14 days free. No card required.</p>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={googleLoading}
          className="btn-secondary mt-6 w-full disabled:opacity-60"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.77h3.55c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.77c-.98.66-2.23 1.06-3.73 1.06-2.87 0-5.3-1.94-6.16-4.53H2.18v2.85A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.85z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.85C6.7 7.32 9.13 5.38 12 5.38z" />
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs font-medium text-muted">
          <span className="h-px flex-1 bg-line" /> OR <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="companyName" className="text-sm font-medium">
              Company / Brand name
            </label>
            <input
              id="companyName"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
              placeholder="Lumora Skincare"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Work email
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
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line px-4 py-2.5 pr-11 text-sm outline-none focus:border-accent"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-[#D66A38]"
            />
            <span className="text-muted">
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="font-medium text-accent">
                Terms & Conditions
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-accent">
                Privacy Policy
              </Link>
              .
            </span>
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !agreedToTerms}
            className="btn-primary w-full disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create free account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
