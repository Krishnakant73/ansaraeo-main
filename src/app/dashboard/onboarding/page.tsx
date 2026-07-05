"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDUSTRIES } from "@/lib/starter-prompts";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    brandName: "",
    domain: "",
    industry: "d2c_fashion",
    category: "",
    competitor: "",
    city: "",
    languages: ["en"] as string[],
  });

  function toggleLanguage(lang: string) {
    setForm((f) => ({
      ...f,
      languages: f.languages.includes(lang)
        ? f.languages.filter((l) => l !== lang)
        : [...f.languages, lang],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();

    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="container-x flex min-h-screen items-center justify-center py-24">
      <div className="card w-full max-w-xl p-8 hover:!translate-y-0 hover:!scale-100">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Step 1 of 1</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Set up your first brand</h1>
        <p className="mt-2 text-sm text-muted">
          We&apos;ll auto-generate starter prompts so your dashboard is never empty.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Brand name</label>
              <input
                required
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                placeholder="Lumora Skincare"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Domain</label>
              <input
                required
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                placeholder="lumora.com"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Industry</label>
            <select
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
            >
              {INDUSTRIES.map((i) => (
                <option key={i.value} value={i.value}>
                  {i.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">
              Product category <span className="text-muted">(used to generate prompts)</span>
            </label>
            <input
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
              placeholder="e.g. face wash, sneakers, protein powder"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Main competitor (optional)</label>
              <input
                value={form.competitor}
                onChange={(e) => setForm({ ...form, competitor: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                placeholder="Competitor name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">City (if local business)</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-accent"
                placeholder="Mumbai"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Track prompts in</label>
            <div className="mt-2 flex gap-2">
              {[
                { value: "en", label: "English" },
                { value: "hi", label: "Hindi" },
              ].map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => toggleLanguage(lang.value)}
                  className={
                    form.languages.includes(lang.value)
                      ? "rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white"
                      : "rounded-full border border-line px-4 py-1.5 text-xs font-medium text-muted"
                  }
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? "Setting up…" : "Create brand & generate prompts"}
          </button>
        </form>
      </div>
    </div>
  );
}
