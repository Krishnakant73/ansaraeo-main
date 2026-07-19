"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { brandScopedHref } from "@/lib/brand-scoped-href";

type SourceCitation = { promptText: string; engineName: string };

// The "Source workspace" — slide-over that opens from a cited domain instead of
// navigating away. Answers ONE question: which of my prompts does this source
// get cited for, and on which engines? Surfaces outreach targets in context.
export default function SourcePanel({
  domain,
  count,
  citations,
}: {
  domain: string;
  count: number;
  citations: SourceCitation[];
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line p-5">
        <p className="section-label">Source workspace</p>
        <h2 className="mt-1 break-all text-lg font-bold tracking-tight text-ink">{domain}</h2>
        <div className="mt-3">
          <span className="chip border-line">Cited {count}×</span>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div>
          <p className="section-label">Cited for these prompts</p>
          {citations.length ? (
            <ul className="mt-2 space-y-3">
              {citations.slice(0, 12).map((c, i) => (
                <li key={i} className="text-sm">
                  <p className="text-ink">&ldquo;{c.promptText}&rdquo;</p>
                  <p className="text-xs capitalize text-muted">{c.engineName}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No citation detail recorded.</p>
          )}
        </div>
        <div>
          <p className="section-label">What you can do here</p>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            <li>See which prompts this third-party source keeps winning instead of you.</li>
            <li>Open the full Citations page for trend, authority, and momentum analysis.</li>
          </ul>
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line p-5">
        <Link
          href={brandScopedHref(pathname, "/citations")}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          Open full page <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </footer>
    </div>
  );
}
