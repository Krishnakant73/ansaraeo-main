"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { NAV_GROUPS } from "./nav-config";

type Crumb = { label: string; href?: string };

function derive(pathname: string): Crumb[] {
  // Find the most-specific nav item that matches this path.
  let best: { group: string; label: string; href: string } | null = null;
  for (const g of NAV_GROUPS) {
    for (const i of g.items) {
      if (pathname === i.href || pathname.startsWith(i.href + "/")) {
        if (!best || i.href.length > best.href.length) {
          best = { group: g.label, label: i.label, href: i.href };
        }
      }
    }
  }
  if (!best) return [];
  // Root dashboard -> just the section label.
  if (best.href === "/dashboard") return [{ label: best.group }];
  return [{ label: best.group }, { label: best.label, href: best.href }];
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = derive(pathname);
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-[12px] text-muted">
      {crumbs.map((c, idx) => (
        <Fragment key={`${c.label}-${idx}`}>
          {idx > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
          {c.href ? (
            <Link href={c.href} className="truncate hover:text-ink">
              {c.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-ink">{c.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
