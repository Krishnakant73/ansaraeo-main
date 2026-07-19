import Link from "next/link";
import "@/workspace/workspaces";
import { list } from "@/workspace/core";

// ============================================================
// /dashboard/w — the workspace picker.
//
// Landing page when someone hits /dashboard/w without a kind. Lists the
// registered workspace kinds so the palette and empty-state links have
// something to resolve to. Kept intentionally spartan for Step 1 — no
// workspaces are registered yet, so this renders an empty state.
// ============================================================

export const dynamic = "force-dynamic";

export default function WorkspacePicker() {
  const kinds = list();
  return (
    <div className="mx-auto max-w-2xl py-12">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Workspaces</h1>
      <p className="mt-2 text-sm text-muted">
        Open a workspace to work with a single object end-to-end.
      </p>
      {kinds.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-line bg-surface p-6 text-sm text-muted">
          No workspaces are registered yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {kinds.map((k) => (
            <li key={k.kind}>
              <Link
                href={`/dashboard/w/${k.kind}`}
                className="block rounded-xl border border-line bg-white p-4 transition-colors hover:border-accent/40"
              >
                <p className="text-sm font-semibold capitalize text-ink">{k.kind}</p>
                <p className="text-xs text-muted">
                  {k.tabs.length} tab{k.tabs.length === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
