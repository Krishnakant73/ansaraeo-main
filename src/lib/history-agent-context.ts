// ============================================================
// history-agent-context.ts — grounds the chat Agent in the brand's
// HISTORICAL record so it can answer "when did ChatGPT first recommend
// us?", "which competitors gained visibility over 12 months?", "which
// citations were lost?". Read-only; built from real history_observations
// and history_events. Honesty: if there is no history, it says so.
// ============================================================

import { getInsights, getUnackedAlertCount } from "@/lib/history-engine";

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

export async function buildHistoryContext(brandId: string): Promise<string> {
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1000);

  let insights;
  try {
    insights = await getInsights(brandId, { from: from.toISOString(), to: to.toISOString() });
  } catch {
    return "HISTORY: unavailable right now.";
  }

  const hasData =
    insights.firstMentionByEngine.length > 0 ||
    insights.competitorMovers.length > 0 ||
    insights.citationChanges.gained > 0 ||
    insights.citationChanges.lost > 0 ||
    insights.promptImprovements.length > 0;

  if (!hasData) {
    return "HISTORY (last 12 months): No recorded history yet — visibility runs are being captured over time. Tell the user we can answer these questions once a few weeks of runs have accumulated.";
  }

  const lines: string[] = ["HISTORY (last 12 months):"];

  if (insights.firstMentionByEngine.length > 0) {
    lines.push(
      "- First recommended by: " +
        insights.firstMentionByEngine
          .map((f) => `${f.engine} on ${fmtDate(f.observed_at)}`)
          .join("; "),
    );
  }

  const gaining = insights.competitorMovers.filter((m) => m.trend === "gaining");
  const losing = insights.competitorMovers.filter((m) => m.trend === "losing");
  if (gaining.length > 0) {
    lines.push(
      "- Competitors GAINING visibility vs you: " +
        gaining.map((m) => `${m.name} (${m.delta > 0 ? "+" : ""}${m.delta} pts)`).join(", "),
    );
  }
  if (losing.length > 0) {
    lines.push(
      "- Competitors LOSING visibility vs you: " +
        losing.map((m) => `${m.name} (${m.delta} pts)`).join(", "),
    );
  }

  if (insights.citationChanges.gained > 0 || insights.citationChanges.lost > 0) {
    lines.push(
      `- Citations: gained ${insights.citationChanges.gained}` +
        (insights.citationChanges.gainedDomains.length
          ? ` (${insights.citationChanges.gainedDomains.slice(0, 5).join(", ")})`
          : "") +
        `, lost ${insights.citationChanges.lost}` +
        (insights.citationChanges.lostDomains.length
          ? ` (${insights.citationChanges.lostDomains.slice(0, 5).join(", ")})`
          : ""),
    );
  }

  const improved = insights.promptImprovements.filter((p) => (p.delta ?? 0) > 0).slice(0, 5);
  if (improved.length > 0) {
    lines.push(
      "- Prompts improving after content updates: " +
        improved
          .map((p) => `"${p.prompt_text}" (${p.delta} pts, now ${p.recentRate}%)`)
          .join("; "),
    );
  }

  if (insights.engineChangeSignals > 0) {
    lines.push(`- AI engine changes that affected visibility: ${insights.engineChangeSignals} signal(s)`);
  }

  try {
    const unacked = await getUnackedAlertCount(brandId);
    if (unacked > 0) {
      lines.push(`- Open history alerts (unaddressed visibility losses): ${unacked} — review the History → Alerts tab.`);
    }
  } catch {
    /* non-fatal: alert summary is best-effort */
  }

  return lines.join("\n");
}
