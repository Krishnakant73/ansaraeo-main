"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ScanReport } from "@/lib/scan-classifier";
import { SavePromptGate } from "@/components/analyze/SavePromptGate";
import { AlertTriangle, ChevronRight, Sparkles, TrendingDown, Trophy } from "lucide-react";

// ============================================================
// ReportView — the payoff screen.
//
// One sentence at the top in the largest type on the page: the verdict.
// Everything else scaffolds around that. The save-your-report gate
// pins to the bottom once the user has scrolled far enough that they've
// clearly received value.
// ============================================================

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
};

function verdictSentence(report: ScanReport, competitorLeader?: { name: string; mentioned: number; total: number }): string {
  const totalStr = `${report.brandMentionedAnswers} of ${report.totalAnswers}`;
  const brand = report.brandName || report.domain;
  if (report.totalAnswers === 0) {
    return `We couldn't get any usable AI answers for ${brand}. This can happen with a very new domain or a category the models don't know yet.`;
  }
  if (competitorLeader && competitorLeader.mentioned > report.brandMentionedAnswers) {
    return `${brand} is mentioned in ${totalStr} AI answers. ${competitorLeader.name} appears in ${competitorLeader.mentioned}.`;
  }
  if (report.brandMentionedAnswers === 0) {
    return `${brand} is not mentioned in any of the ${report.totalAnswers} AI answers we checked.`;
  }
  return `${brand} is mentioned in ${totalStr} AI answers.`;
}

export function ReportView({ scanId, report }: { scanId: string; report: ScanReport }) {
  const competitorLeader = useMemo(() => report.competitorScores[0], [report.competitorScores]);
  const verdict = verdictSentence(report, competitorLeader);
  const score = report.visibilityScore;

  return (
    <div className="mx-auto max-w-3xl pb-40">
      {/* Verdict — largest type on the page */}
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Your AI Brand Report</p>
      <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{verdict}</h1>

      {/* Score band */}
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <ScoreCard label="Visibility score" value={`${score}`} suffix="/100" tone={score >= 50 ? "good" : score >= 20 ? "ok" : "poor"} />
        <ScoreCard label="Answers analyzed" value={`${report.totalAnswers}`} suffix="" />
        <ScoreCard
          label={competitorLeader ? `${competitorLeader.name} appears in` : "No competitors detected"}
          value={competitorLeader ? `${competitorLeader.mentioned}` : "—"}
          suffix={competitorLeader ? `/${competitorLeader.total}` : ""}
          tone={competitorLeader && competitorLeader.mentioned > report.brandMentionedAnswers ? "warn" : "neutral"}
        />
      </div>

      {/* Per-engine breakdown */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight">By engine</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {report.perEngine.map((row) => (
            <div key={row.engine} className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {ENGINE_LABEL[row.engine] ?? row.engine}
              </p>
              <p className="mt-2 text-3xl font-bold text-ink">
                {row.mentioned}
                <span className="text-lg font-medium text-muted">/{row.total}</span>
              </p>
              <p className="mt-1 text-xs text-muted">{row.rate}% mention rate</p>
            </div>
          ))}
        </div>
      </section>

      {/* Competitor comparison */}
      {report.competitorScores.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Where you rank</h2>
          <div className="mt-4 card p-5">
            <ul className="space-y-3">
              {[
                { name: `${report.brandName || report.domain} (you)`, mentioned: report.brandMentionedAnswers, total: report.totalAnswers, isYou: true },
                ...report.competitorScores.map((c) => ({ ...c, isYou: false })),
              ]
                .sort((a, b) => b.mentioned - a.mentioned)
                .map((row) => {
                  const pct = row.total ? Math.round((row.mentioned / row.total) * 100) : 0;
                  return (
                    <li key={row.name} className="flex items-center gap-3">
                      <span className={`w-40 shrink-0 truncate text-sm ${row.isYou ? "font-semibold text-ink" : "text-muted"}`}>
                        {row.name}
                      </span>
                      <div className="flex-1 overflow-hidden rounded-full bg-line/60">
                        <div
                          className={`h-2 rounded-full ${row.isYou ? "bg-accent" : "bg-muted"}`}
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-sm tabular-nums text-muted">
                        {row.mentioned}/{row.total}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        </section>
      )}

      {/* Opportunities */}
      {report.opportunities.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Your biggest opportunities</h2>
          <p className="mt-1 text-sm text-muted">
            Prompts where competitors show up and you don't — the highest-leverage places to publish first.
          </p>
          <ul className="mt-4 space-y-3">
            {report.opportunities.map((op, i) => (
              <li key={i} className="card p-5">
                <div className="flex items-start gap-3">
                  <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">&ldquo;{op.prompt}&rdquo;</p>
                    <p className="mt-1 text-xs text-muted">
                      On {ENGINE_LABEL[op.engine] ?? op.engine}, {op.competitors_present.slice(0, 3).join(", ")}
                      {op.competitors_present.length > 3 ? " and others" : ""} appear. You don't.
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Signup gate — persistent floating bar with in-page anchor for the button */}
      <section id="save" className="mt-14">
        <div className="card p-6 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-accent" />
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Save this report</h2>
          <p className="mt-2 text-sm text-muted">
            Track how these numbers move over time. Get weekly reports. Draft the pages that fix this.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Link
              href={`/signup?scan=${scanId}`}
              prefetch={false}
              className="btn-primary !h-12 !px-6"
            >
              Save with Google
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/signup?scan=${scanId}&method=email`}
              prefetch={false}
              className="btn-secondary !h-12 !px-6"
            >
              Use email instead
            </Link>
          </div>
          <p className="mt-4 text-[11px] text-muted">
            No credit card. Free for 14 days. Cancel in one click.
          </p>
        </div>
      </section>

      <SavePromptGate scanId={scanId} />

      {/* Compliance guard rail — clearly-labeled honesty note */}
      <p className="mt-10 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        AI answer engines are non-deterministic; a single scan is a snapshot, not a permanent ranking.
        AnsarAEO&apos;s tracking suite reruns these prompts nightly across engines and shows you the trend.
        {report.opportunities.length > 0 && (
          <span>{" "}<Trophy className="inline h-3.5 w-3.5" /> Priority queue is available after signup.</span>
        )}
      </p>
    </div>
  );
}

function ScoreCard({ label, value, suffix, tone = "neutral" }: { label: string; value: string; suffix: string; tone?: "good" | "ok" | "poor" | "warn" | "neutral" }) {
  const color =
    tone === "good"
      ? "text-emerald-500"
      : tone === "ok"
        ? "text-amber-500"
        : tone === "poor"
          ? "text-red-500"
          : tone === "warn"
            ? "text-amber-500"
            : "text-ink";
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-4xl font-extrabold tracking-tight tabular-nums">
        <span className={color}>{value}</span>
        {suffix && <span className="text-lg font-medium text-muted">{suffix}</span>}
      </p>
    </div>
  );
}
