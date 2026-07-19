"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "ansaraeo_cookie_consent"; // "accepted" | "declined"

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    // Lazy initializer runs once; guard for SSR where `window` is undefined.
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem(STORAGE_KEY);
  });

  function respond(choice: "accepted" | "declined") {
    window.localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
    // Hook your analytics init (PostHog, GA4, etc.) here, conditional on
    // choice === "accepted", so non-essential cookies only load on consent.
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 md:px-6 md:pb-6"
          role="dialog"
          aria-label="Cookie consent"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-float md:flex-row md:justify-between">
            <p className="text-sm text-muted">
              We use essential cookies to run this site, and optional analytics cookies to improve it. See our{" "}
              <Link href="/privacy" className="font-medium text-accent">
                Privacy Policy
              </Link>{" "}
              for details.
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => respond("declined")}
                className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted hover:border-ink/30"
              >
                Decline
              </button>
              <button
                onClick={() => respond("accepted")}
                className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover"
              >
                Accept all
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
