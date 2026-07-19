import { redirect } from "next/navigation";

// ============================================================
// /dashboard/mission-control — legacy route.
//
// Mission Control absorbed the old analytics dashboard, so the canonical
// home is now /dashboard. This route stays as a permanent redirect so
// bookmarks, in-app links, and external inbound traffic keep working.
// ============================================================

export default function MissionControlLegacyRedirect() {
  redirect("/dashboard");
}
