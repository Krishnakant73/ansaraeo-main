"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Copy, Check, Link as LinkIcon, ShieldAlert } from "lucide-react";

// ============================================================
// ShareLinkModal — client overlay that mints a share_view_tokens
// row via POST /api/share-view-tokens and offers copy-to-clipboard.
//
// Fires on the CustomEvent `<kind>:share-link` with detail
// { workspaceKind, workspaceId, brandId }. The workspace listeners
// bridge dispatches these from their quick-actions.
// ============================================================

type MintedToken = {
  token: string;
  url: string;
  expires_at: string;
};

type EventDetail = {
  workspaceKind: "competitor" | "engine" | "brand";
  workspaceId: string;
  brandId: string;
  label: string;
};

export default function ShareLinkModal({ eventNames }: { eventNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [minted, setMinted] = useState<MintedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Subscribe once per event-name list.
  useEffect(() => {
    function onOpen(e: Event) {
      const d = (e as CustomEvent<EventDetail>).detail;
      if (!d) return;
      setDetail(d);
      setMinted(null);
      setError(null);
      setCopied(false);
      setOpen(true);
    }
    for (const name of eventNames) window.addEventListener(name, onOpen);
    return () => {
      for (const name of eventNames) window.removeEventListener(name, onOpen);
    };
  }, [eventNames]);

  function mint() {
    if (!detail) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/share-view-tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceKind: detail.workspaceKind,
            workspaceId: detail.workspaceId,
            brandId: detail.brandId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to mint");
        setMinted(data as MintedToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Mint failed");
      }
    });
  }

  async function copyLink() {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(minted.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard copy failed");
    }
  }

  if (!open || !detail) return null;

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const expiryDays = minted
    ? Math.max(0, Math.round((new Date(minted.expires_at).getTime() - now) / 86_400_000))
    : 7;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white shadow-float">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <p id="share-modal-title" className="text-sm font-semibold text-ink">
              Share {detail.label}
            </p>
            <p className="text-[11px] text-muted">
              Read-only link · 7-day expiry · revokable
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5">
          {!minted ? (
            <div className="space-y-3">
              <p className="text-sm text-ink/85">
                Mint a read-only link a teammate or client can open without a login.
                The link stops working in {expiryDays} days or when you revoke it.
              </p>
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <ShieldAlert aria-hidden className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p>
                  Recipients see the workspace read-only. They cannot edit, run scans, or
                  see other brands in your org.
                </p>
              </div>
              <button
                type="button"
                onClick={mint}
                disabled={isPending}
                className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <LinkIcon aria-hidden className="h-4 w-4" />
                {isPending ? "Minting…" : "Mint share link"}
              </button>
              {error && (
                <p role="alert" className="text-xs text-rose-600">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="share-link-url" className="section-label">
                  Share URL
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="share-link-url"
                    type="text"
                    readOnly
                    value={minted.url}
                    className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-[11px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="btn-sm inline-flex items-center gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check aria-hidden className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-muted">
                Expires {new Date(minted.expires_at).toLocaleDateString()} ·{" "}
                {expiryDays} day{expiryDays === 1 ? "" : "s"} left.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-sm flex-1"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
