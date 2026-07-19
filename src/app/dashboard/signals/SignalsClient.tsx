"use client";

import { useState } from "react";
import { MessageCircle, Youtube } from "lucide-react";

type SocialMention = {
  source: "reddit" | "youtube";
  title: string;
  url: string;
  snippet: string;
  subredditOrChannel: string;
  score: number;
  createdAt: string | null;
};

type SocialSignals = {
  brandName: string;
  reddit: { available: boolean; mentions: SocialMention[]; note?: string };
  youtube: { available: boolean; mentions: SocialMention[]; note?: string };
  sentiment: { positive: number; neutral: number; negative: number };
  totalMentions: number;
};

function MentionList({ mentions }: { mentions: SocialMention[] }) {
  if (mentions.length === 0) return <p className="mt-2 text-sm text-muted">No recent mentions found.</p>;
  return (
    <div className="mt-3 divide-y divide-line/60">
      {mentions.map((m, i) => (
        <a key={i} href={m.url} target="_blank" rel="noreferrer" className="block py-3 hover:bg-surface/60">
          <p className="text-sm font-medium">{m.title}</p>
          {m.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{m.snippet}</p>}
          <p className="mt-1 text-xs text-muted">
            {m.subredditOrChannel}
            {m.source === "reddit" ? ` · ${m.score} upvotes` : ""}
            {m.createdAt ? ` · ${new Date(m.createdAt).toLocaleDateString("en-IN")}` : ""}
          </p>
        </a>
      ))}
    </div>
  );
}

export default function SignalsClient({ brandId }: { brandId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SocialSignals | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/social-signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setResult(data.result);
    else setError(data.error);
  }

  return (
    <div>
      <button onClick={run} disabled={loading} className="btn-primary !h-11 disabled:opacity-60">
        {loading ? "Scanning…" : result ? "Rescan" : "Scan brand signals"}
      </button>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {result && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="card p-4 text-center">
              <p className="text-xs text-muted">Total mentions</p>
              <p className="mt-1 text-2xl font-extrabold">{result.totalMentions}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-emerald-600">Positive</p>
              <p className="mt-1 text-2xl font-extrabold">{result.sentiment.positive}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-muted">Neutral</p>
              <p className="mt-1 text-2xl font-extrabold">{result.sentiment.neutral}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-red-500">Negative</p>
              <p className="mt-1 text-2xl font-extrabold">{result.sentiment.negative}</p>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-orange-500" />
              <p className="font-semibold">Reddit</p>
            </div>
            {result.reddit.note && <p className="mt-2 text-sm text-amber-600">{result.reddit.note}</p>}
            <MentionList mentions={result.reddit.mentions} />
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2">
              <Youtube className="h-4 w-4 text-red-500" />
              <p className="font-semibold">YouTube</p>
            </div>
            {result.youtube.note && <p className="mt-2 text-sm text-amber-600">{result.youtube.note}</p>}
            <MentionList mentions={result.youtube.mentions} />
          </div>
        </div>
      )}
    </div>
  );
}
