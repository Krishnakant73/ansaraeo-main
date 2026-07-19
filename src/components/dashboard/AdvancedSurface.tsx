"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Sparkles } from "lucide-react";
import { Braces, FileCheck2, FileLock2, Share2, FileStack, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The 6 power validators that live in the nav "Advanced" group. This map is the
// single source of truth for their label/href/icon so the contextual surface
// stays in sync with nav-config (same hrefs, no 404s).
const VALIDATORS = {
  schema: {
    label: "Schema-for-AI",
    href: "/dashboard/schema",
    description: "Validate Organization / Product / FAQ JSON-LD for AI parsers.",
    icon: Braces,
  },
  llmsTxt: {
    label: "llms.txt Validator",
    href: "/dashboard/llms-txt",
    description: "Check your llms.txt against the published spec.",
    icon: FileCheck2,
  },
  robots: {
    label: "Robots Check",
    href: "/dashboard/robots",
    description: "Verify robots.txt welcomes AI crawlers.",
    icon: FileLock2,
  },
  internalLinks: {
    label: "Internal Links",
    href: "/dashboard/internal-links",
    description: "Map internal link equity and orphan pages.",
    icon: Share2,
  },
  tokenBloat: {
    label: "Token Bloat",
    href: "/dashboard/token-bloat",
    description: "Find pages that waste AI context budget.",
    icon: FileStack,
  },
  headerLinks: {
    label: "Header & Link Graph",
    href: "/dashboard/header-links",
    description: "Inspect response headers and the outbound link graph.",
    icon: Link2,
  },
} as const;

export type ValidatorKey = keyof typeof VALIDATORS;
export type ValidatorSignal = { key: ValidatorKey; flagged: boolean; reason?: string };

// Progressive disclosure: a single "Advanced validators" card that surfaces the
// deep checks *relevant to the current audit*. It auto-opens when the audit
// flagged something (flagged=true) and stays collapsed otherwise, so the power
// tools no longer sit at the same mental level as the dashboard — they appear
// exactly when a finding calls for them.
export default function AdvancedSurface({ signals }: { signals: ValidatorSignal[] }) {
  const flaggedCount = signals.filter((s) => s.flagged).length;
  const [open, setOpen] = useState(flaggedCount > 0);

  const ordered = (Object.keys(VALIDATORS) as ValidatorKey[]).map((key) => {
    const sig = signals.find((s) => s.key === key);
    return { key, ...VALIDATORS[key], flagged: sig?.flagged ?? false, reason: sig?.reason };
  });

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-accent" />
          <div>
            <p className="text-sm font-semibold text-ink">Advanced validators</p>
            <p className="text-xs text-muted">
              {flaggedCount > 0
                ? `${flaggedCount} surfaced from this audit — open the deep check to fix.`
                : "Nothing flagged by this audit — expand to review."}
            </p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-line p-5">
          <div className="space-y-2">
            {ordered.map((v) => {
              const Icon = v.icon;
              return (
                <Link
                  key={v.key}
                  href={v.href}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
                    v.flagged ? "border-amber-200 bg-amber-50 hover:bg-amber-100/70" : "border-line hover:bg-surface"
                  )}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", v.flagged ? "text-amber-600" : "text-muted")} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{v.label}</p>
                      <p className="truncate text-xs text-muted">
                        {v.flagged && v.reason ? v.reason : v.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      v.flagged ? "bg-amber-100 text-amber-700" : "bg-grid text-muted"
                    )}
                  >
                    {v.flagged ? "Open" : "Review"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
