import Link from "next/link";
import { Instagram, Linkedin, Twitter, Youtube } from "lucide-react";

const COLS = [
  {
    title: "Product",
    links: [
      { label: "Prompt Tracking", href: "/#features" },
      { label: "Visibility Score", href: "/#features" },
      { label: "AI Agent", href: "/#agent" },
      { label: "Site Audit", href: "/#features" },
      { label: "Auto-Fix", href: "/#features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/resources" },
      { label: "AEO Guide", href: "/resources" },
      { label: "Docs", href: "/resources" },
      { label: "Changelog", href: "/resources" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/about" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms & Conditions", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Refund Policy", href: "/refund-policy" },
    ],
  },
];

const SOCIALS = [
  { icon: Twitter, label: "Twitter" },
  { icon: Linkedin, label: "LinkedIn" },
  { icon: Youtube, label: "YouTube" },
  { icon: Instagram, label: "Instagram" },
];

export default function Footer() {
  return (
    <footer id="footer" className="rounded-t-[28px] bg-[#171312] text-white">
      <div className="container-x grid grid-cols-2 gap-10 py-16 md:grid-cols-5 md:py-20">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs font-extrabold text-white">A</span>
            AnsarAEO
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-white/50">
            India-first AI search visibility. Built in India, priced in ₹.
          </p>
          <p className="mt-2 text-sm text-white/50">
            <a href="mailto:admin@ansaraeo.com" className="hover:text-white">admin@ansaraeo.com</a>
          </p>
          <div className="mt-6 flex gap-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-accent hover:text-accent"
              >
                <s.icon className="h-4 w-4" aria-hidden />
              </a>
            ))}
          </div>
        </div>
        {COLS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-semibold">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-white/50 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-6 py-8 md:flex-row">
          <p className="text-xs text-white/40">© 2026 AnsarAEO. All rights reserved.</p>
          <form className="flex w-full max-w-sm gap-2" aria-label="Newsletter signup">
            <label htmlFor="footer-newsletter" className="sr-only">
              Email for newsletter
            </label>
            <input
              id="footer-newsletter"
              type="email"
              placeholder="Get the weekly AEO digest"
              className="h-11 flex-1 rounded-full border border-white/15 bg-white/5 px-5 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-accent"
            />
            <button
              type="submit"
              className="h-11 rounded-full bg-accent px-6 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>
    </footer>
  );
}
