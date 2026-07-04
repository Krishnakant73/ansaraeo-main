"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Product", href: "/product" },
  { label: "Agencies", href: "/agency" },
  { label: "Pricing", href: "/pricing" },
  { label: "Resources", href: "/resources" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-line bg-white/70 backdrop-blur-xl" : "bg-transparent"
      )}
    >
      <nav className="container-x flex h-16 items-center justify-between" aria-label="Main">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs font-extrabold text-white">A</span>
          AnsarAEO
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-sm font-medium text-muted transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="text-sm font-medium text-muted transition-colors hover:text-ink">
            Login
          </Link>
          <Link href="/signup" className="btn-primary !h-10 !px-5">
            Start Free
          </Link>
        </div>
        <button
          type="button"
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden border-b border-line bg-white md:hidden"
          >
            <div className="container-x flex flex-col gap-4 py-6">
              {LINKS.map((l) => (
                <a key={l.label} href={l.href} className="text-sm font-medium text-muted" onClick={() => setOpen(false)}>
                  {l.label}
                </a>
              ))}
              <Link href="/signup" className="btn-primary w-full">
                Start Free
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
