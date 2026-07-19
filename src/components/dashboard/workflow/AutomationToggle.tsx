"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AutomationToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(active);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/workflow/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !on }),
      });
      if (res.ok) {
        setOn(!on);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      role="switch"
      aria-checked={on}
      className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-accent" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-4" : "left-0.5"}`} />
    </button>
  );
}
