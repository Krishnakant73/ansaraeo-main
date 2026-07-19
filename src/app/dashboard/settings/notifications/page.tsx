"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Panel } from "@/components/dashboard/panel";

type Pref = { key: string; label: string; description: string };
const PREFS: Pref[] = [
  {
    key: "weekly_report",
    label: "Weekly report email",
    description: "A digest of your visibility, citations, and opportunities each week.",
  },
  {
    key: "alerts",
    label: "Priority alerts",
    description: "Notify me when a prompt I track loses or gains a mention.",
  },
  {
    key: "copilot_tips",
    label: "Copilot suggestions",
    description: "Surface contextual next-steps from the AI Copilot on each page.",
  },
];

const STORAGE_KEY = "ansaraeo.notifications";

export default function NotificationsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEnabled(JSON.parse(raw));
    } catch {
      /* ignore unavailable storage */
    }
    setLoaded(true);
  }, []);

  function toggle(key: string) {
    setEnabled((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Choose what AnsarAEO surfaces for you" />
      <div className="mt-6 max-w-xl space-y-6">
        <Panel title="Preferences" description="Saved on this device — these control your local experience, not server-side emails.">
          <ul className="divide-y divide-line">
            {PREFS.map((p) => (
              <li key={p.key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{p.label}</p>
                  <p className="text-xs text-muted">{p.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(p.key)}
                  disabled={!loaded}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    enabled[p.key] ? "bg-accent" : "bg-grid"
                  }`}
                  role="switch"
                  aria-checked={!!enabled[p.key]}
                  aria-label={p.label}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      enabled[p.key] ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <p className="text-xs text-muted">
          Server-side email delivery (weekly reports, priority alerts) is configured from Plan &amp; Billing and the
          alert engines — these toggles adjust your in-app experience.
        </p>
      </div>
    </div>
  );
}
