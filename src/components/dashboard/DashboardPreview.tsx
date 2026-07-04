"use client";

import { BarChart3, Bot, FileSearch, Home, MessageSquare, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { icon: Home, label: "Dashboard", active: true },
  { icon: MessageSquare, label: "Prompts", active: false },
  { icon: FileSearch, label: "Citations", active: false },
  { icon: Bot, label: "Agent", active: false },
  { icon: BarChart3, label: "Reports", active: false },
  { icon: Settings, label: "Settings", active: false },
];

const VOICE = [
  { name: "Your brand", value: 62, accent: true },
  { name: "Competitor A", value: 41, accent: false },
  { name: "Competitor B", value: 28, accent: false },
];

const OPPORTUNITIES = [
  "Add FAQ schema to /pricing",
  "Hindi prompt gap: skincare",
  "Get cited on 2 review sites",
  "Publish llms.txt",
  "Refresh comparison page",
];

export default function DashboardPreview() {
  return (
    <div className="animate-floaty mx-auto max-w-5xl text-left">
      <div className="overflow-hidden rounded-3xl border border-line bg-white/90 shadow-float backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-line bg-surface px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" aria-hidden />
          <div className="mx-auto flex items-center gap-2 rounded-full border border-line bg-white px-4 py-1 text-[11px] text-muted">
            <Search className="h-3 w-3" aria-hidden />
            app.ansaraeo.com/dashboard
          </div>
        </div>
        <div className="flex">
          <aside className="hidden w-44 shrink-0 border-r border-line bg-surface/60 p-3 md:block" aria-hidden>
            <div className="space-y-1">
              {NAV.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium",
                    item.active ? "bg-accent/10 text-accent" : "text-muted"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
              ))}
            </div>
          </aside>
          <div className="grid flex-1 gap-4 p-4 md:grid-cols-3 md:p-6">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm md:col-span-2">
              <p className="text-xs font-medium text-muted">Visibility Score</p>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-4xl font-extrabold tracking-tight">62</span>
                <span className="mb-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">+8 this week</span>
              </div>
              <p className="mt-1 text-[11px] text-muted">Mentioned in 62% of tracked prompts — mainly driven by Perplexity.</p>
              <svg viewBox="0 0 320 72" className="mt-4 w-full" aria-hidden>
                <defs>
                  <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D66A38" />
                    <stop offset="100%" stopColor="#D66A38" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 58 C 30 54, 48 40, 76 46 S 128 28, 156 32 S 210 14, 246 20 S 300 6, 320 10 L 320 72 L 0 72 Z"
                  fill="url(#spark)"
                  opacity="0.15"
                />
                <path
                  d="M0 58 C 30 54, 48 40, 76 46 S 128 28, 156 32 S 210 14, 246 20 S 300 6, 320 10"
                  fill="none"
                  stroke="#D66A38"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <p className="mt-2 text-[10px] text-muted">Last checked 6 hours ago via live model queries</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-muted">Top 5 Opportunities</p>
              <ul className="mt-3 space-y-2.5">
                {OPPORTUNITIES.map((o) => (
                  <li key={o} className="flex items-center gap-2 text-[11px] font-medium">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-line bg-white p-5 shadow-sm md:col-span-3">
              <p className="text-xs font-medium text-muted">Share of Voice</p>
              <div className="mt-3 space-y-3">
                {VOICE.map((v) => (
                  <div key={v.name} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[11px] font-medium text-muted">{v.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-grid">
                      <div
                        className={v.accent ? "h-full rounded-full bg-accent" : "h-full rounded-full bg-ink/20"}
                        style={{ width: `${v.value}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] font-semibold">{v.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
