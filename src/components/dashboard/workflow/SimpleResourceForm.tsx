"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "number" | "json";
  placeholder?: string;
  required?: boolean;
};

export default function SimpleResourceForm({
  resource,
  fields,
  buttonLabel = "Create",
  compact = false,
}: {
  resource: string;
  fields: FieldDef[];
  buttonLabel?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(name: string, v: string) {
    setValues((p) => ({ ...p, [name]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name] ?? "";
      if (f.required && !v.trim()) {
        setError(`${f.label} is required`);
        setBusy(false);
        return;
      }
      if (f.type === "number") out[f.name] = v === "" ? null : Number(v);
      else if (f.type === "date") out[f.name] = v === "" ? null : v;
      else if (f.type === "json") {
        try {
          out[f.name] = v.trim() === "" ? [] : JSON.parse(v);
        } catch {
          setError(`${f.label} must be valid JSON`);
          setBusy(false);
          return;
        }
      } else out[f.name] = v;
    }
    try {
      const res = await fetch("/api/workflow/generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, fields: out }),
      });
      if (res.ok) {
        setValues({});
        setOpen(false);
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Create failed");
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={compact ? "btn-xs btn-xs-accent" : "btn-sm"} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {buttonLabel}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-line bg-white p-3">
      {fields.map((f) => (
        <label key={f.name} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">{f.label}</span>
          {f.type === "textarea" ? (
            <textarea
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              rows={2}
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
          ) : f.type === "json" ? (
            <textarea
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder ?? "[]"}
              rows={3}
              className="rounded-lg border border-line px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            />
          ) : (
            <input
              type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
              value={values[f.name] ?? ""}
              onChange={(e) => set(f.name, e.target.value)}
              placeholder={f.placeholder}
              className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
          )}
        </label>
      ))}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-sm">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonLabel}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
