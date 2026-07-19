import Link from "next/link";

// ============================================================
// ScoreDuelCard — the biggest visual anchor on Mission Control.
//
// Two numbers, side by side: your visibility score and your top
// competitor's. Both huge, competitor number in a contrast color to
// make the delta emotionally readable at a glance.
// ============================================================

type Props = {
  brandName: string;
  brandScore: number;
  competitorName: string | null;
  competitorScore: number | null;
  totalAnswers: number;
};

export function ScoreDuelCard({
  brandName,
  brandScore,
  competitorName,
  competitorScore,
  totalAnswers,
}: Props) {
  const gap = competitorScore != null ? competitorScore - brandScore : 0;
  const winning = competitorScore == null || brandScore >= competitorScore;

  return (
    <div className="card p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        {/* You */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {brandName || "You"}
          </p>
          <p className="mt-2 flex items-baseline gap-2 text-6xl font-extrabold tracking-tight tabular-nums text-accent md:text-7xl">
            {brandScore}
            <span className="text-2xl font-semibold text-muted md:text-3xl">/100</span>
          </p>
          <p className="mt-2 text-xs text-muted">Across {totalAnswers} recent AI answers</p>
        </div>

        {/* vs */}
        {competitorName && competitorScore != null && (
          <>
            <div aria-hidden className="text-2xl font-bold uppercase text-muted md:self-center">
              vs
            </div>
            <div className="min-w-0 flex-1 text-right md:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                {competitorName}
              </p>
              <p
                className={`mt-2 flex items-baseline justify-end gap-2 text-6xl font-extrabold tracking-tight tabular-nums md:justify-start md:text-7xl ${
                  winning ? "text-muted" : "text-red-500"
                }`}
              >
                {competitorScore}
                <span className="text-2xl font-semibold text-muted md:text-3xl">/100</span>
              </p>
              <p className="mt-2 text-xs text-muted">
                {winning
                  ? "You're ahead."
                  : `They're ${gap} points ahead. That's the gap to close.`}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/dashboard/competitors" className="btn-secondary !h-9 !px-4 !text-sm">
          Competitor detail
        </Link>
        <Link href="/dashboard/content" className="btn-primary !h-9 !px-4 !text-sm">
          Draft an answer block
        </Link>
      </div>
    </div>
  );
}
