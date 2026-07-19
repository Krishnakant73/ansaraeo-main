"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GoalKey } from "@/lib/copilot-proposals";

// ============================================================
// CopilotIntroActions — client-side buttons for the Copilot intro
// screen. Kept small and standalone so the server page remains SSR.
// ============================================================

export function CopilotIntroActions({
  brandId,
  goal,
  hasPrompt,
  primaryCta,
}: {
  brandId: string;
  goal: GoalKey;
  hasPrompt: boolean;
  primaryCta: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDraft() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/first-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, goal }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        contentItemId?: string;
      };
      if (!res.ok || !data.ok || !data.contentItemId) {
        setError(data.error ?? "Couldn't create the draft. Try again.");
        setSubmitting(false);
        return;
      }
      router.push(`/dashboard/content/${data.contentItemId}`);
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      {error && <p className="text-sm text-red-500 sm:mr-auto">{error}</p>}
      <button
        type="button"
        onClick={() => router.push("/dashboard/mission-control")}
        className="btn-secondary !h-10 !px-4"
      >
        Show me Mission Control
      </button>
      <button
        type="button"
        onClick={handleDraft}
        disabled={submitting || !hasPrompt}
        className="btn-primary !h-10 !px-5 disabled:opacity-60"
      >
        {submitting ? "Drafting…" : primaryCta}
      </button>
    </div>
  );
}
