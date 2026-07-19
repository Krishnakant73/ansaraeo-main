import Link from "next/link";
import InsightCard from "@/workspace/primitives/InsightCard";
import { timeAgo, type Team } from "@/lib/team-workspace";

// ============================================================
// Team › Overview — what the team is, who's on it, and where it
// operates. Members surfaced by user_id (auth.users can't be joined
// through the cookie client — the /members admin page already handles
// the name-resolution flow).
// ============================================================

export default function OverviewBody({ team }: { team: Team }) {
  const leads = team.members.filter((m) => m.role === "lead");
  const members = team.members.filter((m) => m.role !== "lead");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">Team</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{team.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              {team.description ?? (
                <span className="italic text-muted">
                  No description set — teams work best with a one-line purpose.
                </span>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Age</p>
            <p className="text-2xl font-bold tracking-tight text-ink">{team.stats.ageInDays}d</p>
            <p className="text-[11px] text-muted">since created</p>
          </div>
        </div>
      </section>

      {team.stats.memberCount === 0 && (
        <InsightCard
          variant="warning"
          title="No members yet"
          description="Invite teammates from the org's Members page — a team without members can't own missions."
          href="/dashboard/settings/members"
        />
      )}
      {team.stats.leadCount === 0 && team.stats.memberCount > 0 && (
        <InsightCard
          variant="opportunity"
          title="No lead assigned"
          description="Every team benefits from a designated lead — promote a member to unblock approvals."
        />
      )}

      {/* Leads */}
      {leads.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Leads ({leads.length})</h3>
          <ul className="space-y-2">
            {leads.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    <code className="rounded bg-surface px-1.5 py-0.5 text-[11px]">
                      {m.user_id.slice(0, 8)}…
                    </code>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">joined {timeAgo(m.created_at)}</p>
                </div>
                <span className="chip border-accent/30 bg-accent/5 text-accent">lead</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Members */}
      {members.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Members ({members.length})</h3>
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    <code className="rounded bg-surface px-1.5 py-0.5 text-[11px]">
                      {m.user_id.slice(0, 8)}…
                    </code>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">joined {timeAgo(m.created_at)}</p>
                </div>
                <span className="chip">member</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            User names live in Supabase Auth — resolve via the{" "}
            <Link href="/dashboard/settings/members" className="text-accent hover:underline">
              Members page
            </Link>
            .
          </p>
        </section>
      )}

      {/* Brands under org */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-ink">
          Brands under {team.org.name ?? "this org"} ({team.brands.length})
        </h3>
        {team.brands.length === 0 ? (
          <p className="text-sm text-muted">No brands yet — add one on the welcome flow.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {team.brands.slice(0, 8).map((b) => (
              <li key={b.id}>
                <Link
                  href={`/dashboard/w/brand/${b.slug}/overview`}
                  className="block rounded-xl border border-line bg-white p-3 transition-colors hover:border-accent/40"
                >
                  <p className="truncate text-sm font-medium text-ink">{b.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{b.slug}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {team.brands.length > 8 && (
          <p className="mt-2 text-[11px] text-muted">…and {team.brands.length - 8} more</p>
        )}
      </section>
    </div>
  );
}
