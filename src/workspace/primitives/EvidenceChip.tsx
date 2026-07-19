import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// EvidenceChip — inline "→ 14 runs · 4 threads" affordance used on
// trait cards, opportunity cards, and any assertion that must trace
// to backing rows. Renders as a link when `href` is provided so the
// evidence is always one click away (Similarweb: never a number
// without its cause; Stripe: trace to source within 2 clicks).
// ============================================================

export default function EvidenceChip({
  parts,
  href,
  label,
  className,
}: {
  parts: string[];                    // e.g. ["14 runs", "4 threads"]
  href?: string;
  label?: string;                     // sr-only prefix ("Evidence:" by default)
  className?: string;
}) {
  const body = (
    <>
      <span className="sr-only">{label ?? "Evidence"}:</span>
      <span aria-hidden className="text-muted">→</span>
      <span>{parts.join(" · ")}</span>
      {href && <ArrowUpRight aria-hidden className="h-3 w-3 opacity-60" />}
    </>
  );
  const classes = cn(
    "inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-muted",
    href && "hover:border-accent/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }
  return <span className={classes}>{body}</span>;
}
