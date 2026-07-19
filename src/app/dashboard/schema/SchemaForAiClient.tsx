"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type TemplateOption = { type: string; label: string; description: string };

export default function SchemaForAiClient({
  brandId,
  brandName,
  domain,
}: {
  brandId: string | null;
  brandName: string;
  domain: string;
}) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [type, setType] = useState("organization");
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    type: string | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.templates);
        if (data.templates.length) setType(data.templates[0].type);
      }
    })();
  }, []);

  async function loadTemplate() {
    setLoading(true);
    setError("");
    setValidation(null);
    const res = await fetch("/api/schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: brandId ? "generate" : "template",
        type,
        brandName,
        domain,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setJson(data.template ?? data.json ?? "");
    else setError(data.error);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (type) loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function validate() {
    if (!json.trim()) {
      setError("Paste or generate JSON-LD to validate.");
      return;
    }
    setValidating(true);
    setError("");
    const res = await fetch("/api/schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate", json }),
    });
    const data = await res.json();
    setValidating(false);
    if (res.ok) setValidation(data.result);
    else setError(data.error);
  }

  return (
    <div className="card space-y-4 p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-medium text-muted">Schema type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 block rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
          >
            {templates.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button onClick={loadTemplate} disabled={loading} className="btn-secondary !h-10 disabled:opacity-60">
          {loading ? "Loading…" : "Generate template"}
        </button>
        <button onClick={validate} disabled={validating} className="btn-primary !h-10 disabled:opacity-60">
          {validating ? "Validating…" : "Validate JSON-LD"}
        </button>
      </div>

      {templates.find((t) => t.type === type)?.description && (
        <p className="text-xs text-muted">{templates.find((t) => t.type === type)?.description}</p>
      )}

      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={16}
        spellCheck={false}
        placeholder='{ "@context": "https://schema.org", "@type": "Organization", ... }'
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 font-mono text-xs leading-relaxed outline-none focus:border-accent"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      {validation && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            validation.valid
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="font-semibold">
            {validation.valid ? "Valid JSON-LD" : "Invalid JSON-LD"}
            {validation.type ? ` — @type: ${validation.type}` : ""}
          </p>
          <ul className="mt-2 space-y-1">
            {validation.errors.map((e, i) => (
              <li key={i} className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                {e}
              </li>
            ))}
            {validation.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                {w}
              </li>
            ))}
            {validation.errors.length === 0 && validation.warnings.length === 0 && (
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                All required and recommended fields are present.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
