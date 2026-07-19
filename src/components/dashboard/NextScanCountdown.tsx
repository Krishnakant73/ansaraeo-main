"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

// ============================================================
// NextScanCountdown — the "come back tomorrow" habit primitive.
//
// The nightly cron in vercel.json runs at `30 20 * * *` UTC, which is
// 02:00 IST. This card ticks down to that time in the user's own
// timezone (still expressed in IST so the number is stable across
// visits — the timezone the operator scheduled the cron in). Purely
// visual; nothing gates on it.
// ============================================================

function nextScanAt(): Date {
  // Cron runs at 20:30 UTC daily.
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(20, 30, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}

function format(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function NextScanCountdown() {
  const [ms, setMs] = useState<number>(() => nextScanAt().getTime() - Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setMs(nextScanAt().getTime() - Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
        <Timer className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Next scan in</p>
        <p className="text-2xl font-bold tabular-nums text-ink">{format(ms)}</p>
      </div>
    </div>
  );
}
