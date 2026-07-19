"use client";

import { useState } from "react";
import { Copy, Check, Send } from "lucide-react";

type AiIndexResult = {
  llmsTxt: string;
  robotsSnippet: string;
  jsonLd: string;
  sourcePages: { url: string; title: string }[];
  notes: string[];
  intentPages: string;
  retrievalVocab: string;
  seoMd: string;
  aiTxt: string;
  llmTxt: string;
  markdownRoutes: string;
  aeoJson: string;
  entityJson: string;
};

function FileBlock({ title, filename, content }: { title: string; filename: string; content: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted">{filename}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className="btn-secondary !h-9 inline-flex items-center gap-1.5 text-xs">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button onClick={download} className="btn-secondary !h-9 text-xs">
            Download
          </button>
        </div>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-surface p-3 text-xs leading-relaxed">
        <code>{content}</code>
      </pre>
    </div>
  );
}

export default function AiIndexClient({ brandId }: { brandId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiIndexResult | null>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/ai-index", {
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
        {loading ? "Generating…" : result ? "Regenerate" : "Generate AI index files"}
      </button>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      {result && (
        <div className="mt-6 space-y-4">
          {result.notes.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {result.notes.map((n, i) => (
                <p key={i}>• {n}</p>
              ))}
            </div>
          )}
          <FileBlock title="llms.txt" filename="llms.txt" content={result.llmsTxt} />
          <FileBlock title="robots.txt — AI crawler block" filename="robots-ai-block.txt" content={result.robotsSnippet} />
          <FileBlock title="Organization JSON-LD (add to homepage <head>)" filename="organization.jsonld" content={result.jsonLd} />
          <FileBlock title="AI Intent Pages" filename="ai-intent-pages.md" content={result.intentPages} />
          <FileBlock title="Retrieval Vocabulary" filename="retrieval-vocab.txt" content={result.retrievalVocab} />
          <FileBlock title="SEO.md — unified AEO spec" filename="seo.md" content={result.seoMd} />
          <FileBlock title="ai.txt — concise AI-agent description" filename="ai.txt" content={result.aiTxt} />
          <FileBlock title="llm.txt — short variant" filename="llm.txt" content={result.llmTxt} />
          <FileBlock title="Markdown routes (HTML <link> snippet)" filename="markdown-routes.html" content={result.markdownRoutes} />
          <FileBlock title="aeo.json — atomic Q/A facts" filename="aeo.json" content={result.aeoJson} />
          <FileBlock title="entity.json — entity graph (sameAs)" filename="entity.json" content={result.entityJson} />
          <p className="text-xs text-muted">
            Placeholders like <code>[ADD …]</code> mark facts only you can confirm — fill them in before publishing so AI
            engines cite accurate information.
          </p>

          <IndexNowSection />
        </div>
      )}
    </div>
  );
}

function IndexNowSection() {
  const [key, setKey] = useState("");
  const [urls, setUrls] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; status: number | null; note: string } | null>(null);
  const [err, setErr] = useState("");

  async function submit() {
    setSubmitting(true);
    setErr("");
    setOutcome(null);
    const urlList = urls
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (!key.trim() || urlList.length === 0) {
      setErr("Enter your IndexNow key and at least one URL (one per line).");
      setSubmitting(false);
      return;
    }
    const res = await fetch("/api/ai-index/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key.trim(), host: new URL(urlList[0]).host, urlList }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) setOutcome({ ok: data.ok, status: data.status, note: data.note });
    else setErr(data.error);
  }

  return (
    <div className="card p-5">
      <p className="font-semibold">Submit to IndexNow</p>
      <p className="mt-1 text-xs text-muted">
        Tell search engines to re-crawl your published AI-index files. You must host a key file named{" "}
        <code>&lt;key&gt;.txt</code> containing the key at your domain root so IndexNow can verify the submission.
      </p>
      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted">IndexNow key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="your-indexnow-key"
            className="mt-1 w-full rounded-lg border divide-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted">URLs to submit (one per line)</label>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={"https://yourdomain.com/llms.txt\nhttps://yourdomain.com/robots.txt"}
            rows={4}
            className="mt-1 w-full rounded-lg border divide-line bg-surface px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="btn-primary !h-10 inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {submitting ? "Submitting…" : "Submit to IndexNow"}
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
      {outcome && (
        <div
          className={`mt-3 rounded-lg p-3 text-sm ${
            outcome.ok ? "border border-green-200 bg-green-50 text-green-800" : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p>
            <strong>{outcome.ok ? "Success" : "Failed"}</strong>
            {outcome.status !== null ? ` (HTTP ${outcome.status})` : ""}
          </p>
          <p className="mt-1">{outcome.note}</p>
        </div>
      )}
    </div>
  );
}
