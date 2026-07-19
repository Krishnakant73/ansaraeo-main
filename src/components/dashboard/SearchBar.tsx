"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { NAV_GROUPS } from "./nav-config";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type FlatItem = { label: string; href: string; group: string };

export default function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const items = useMemo<FlatItem[]>(
    () =>
      NAV_GROUPS.flatMap((g) =>
        g.items.map((i) => ({ label: i.label, href: i.href, group: g.label })),
      ),
    [],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.href.toLowerCase().includes(q),
    );
  }, [query, items]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active].href);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-muted transition hover:border-ink/20"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden rounded border border-line bg-white px-1.5 text-[10px] font-semibold text-muted sm:inline">
            ⌘K
          </kbd>
        </button>
      </DialogTrigger>
      <DialogContent className="top-[15%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search AnsarAEO</DialogTitle>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKey}
            placeholder="Jump to a page…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted">No matches.</li>
          )}
          {results.map((item, i) => (
            <li key={item.href}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.href)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                  i === active ? "bg-accent/10 text-accent" : "text-ink hover:bg-surface"
                }`}
              >
                <span>{item.label}</span>
                <span className="text-[11px] uppercase tracking-wide text-muted">
                  {item.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
