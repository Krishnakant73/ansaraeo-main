"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// ============================================================
// CelebrationModal — the full-screen moment for tier ≥ first_mention.
//
// Renders a large card that includes the shareable OG image (fetched
// from /api/share/[scanId]) so the user can screenshot or share
// directly. Includes pre-composed share buttons for WhatsApp, Twitter,
// and LinkedIn — the copy is intentionally short and specific.
//
// Confetti is a small CSS-only sprinkle; no heavy library to avoid
// dragging in a huge dependency for a rare-event surface.
// ============================================================

type Props = {
  scanId: string | null;
  headline: string;
  detail: string;
  shareTitle: string;
  shareable: boolean;
  onDismiss: () => void;
};

const CONFETTI_COLORS = ["#D66A38", "#10B981", "#F59E0B", "#3B82F6", "#EC4899"];

function ConfettiSprinkle() {
  const pieces = Array.from({ length: 30 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((_, i) => {
        const left = (i * 37) % 100;
        const delay = (i * 90) % 1200;
        const duration = 1400 + ((i * 71) % 1200);
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        return (
          <span
            key={i}
            className="absolute -top-4 h-2 w-2 rounded-sm opacity-90"
            style={{
              left: `${left}%`,
              background: color,
              animation: `confetti-fall ${duration}ms ${delay}ms linear forwards`,
            }}
          />
        );
      })}
      <style>{`@keyframes confetti-fall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(120vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  );
}

export function CelebrationModal({ scanId, headline, detail, shareTitle, shareable, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger the fade-in on next frame so the CSS transition applies.
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://ansaraeo.com";
  const shareText = encodeURIComponent(shareTitle);
  const shareLink = encodeURIComponent(scanId ? `${shareUrl}/analyze/${scanId}/report` : shareUrl);
  const imgSrc = scanId ? `/api/share/${scanId}` : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={headline}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {shareable && <ConfettiSprinkle />}

      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl md:p-8">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close celebration"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted hover:bg-line/50"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Milestone</p>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">{headline}</h2>
        <p className="mt-2 text-sm text-muted">{detail}</p>

        {imgSrc && shareable && (
          <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt=""
              width={1200}
              height={630}
              className="block h-auto w-full"
            />
          </div>
        )}

        {shareable && (
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={`https://api.whatsapp.com/send?text=${shareText}%20${shareLink}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary !h-9 !px-3 !text-xs"
            >
              Share on WhatsApp
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareLink}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary !h-9 !px-3 !text-xs"
            >
              Share on Twitter
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareLink}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary !h-9 !px-3 !text-xs"
            >
              Share on LinkedIn
            </a>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onDismiss} className="btn-primary !h-10 !px-5">
            Keep going
          </button>
        </div>
      </div>
    </div>
  );
}
