import type { Team } from "@/lib/team-workspace";
import TeamCopilotCanvas from "./TeamCopilotCanvas.client";

export default function CopilotBody({ team }: { team: Team }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Ask about this team</h2>
        <p className="mt-1 text-sm text-muted">
          Copilot is grounded on the team + members + missions. Never invents roles or ownership.
        </p>
      </div>
      <TeamCopilotCanvas
        teamId={team.id}
        teamName={team.name}
        orgName={team.org.name ?? "org"}
      />
    </div>
  );
}
