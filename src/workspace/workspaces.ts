// ============================================================
// Workspace registration — the one import that side-effect registers
// every descriptor.
//
// Route handlers under /dashboard/w/ import this file at request time
// (via the layout) to guarantee the registry is populated. Adding a new
// workspace is: (1) create <kind>/workspace.tsx, (2) add two lines here.
// ============================================================

import brand from "@/app/dashboard/w/brand/workspace";
import prompt from "@/app/dashboard/w/prompt/workspace";
import competitor from "@/app/dashboard/w/competitor/workspace";
import campaign from "@/app/dashboard/w/campaign/workspace";
import mission from "@/app/dashboard/w/mission/workspace";
import sprint from "@/app/dashboard/w/sprint/workspace";
import engine from "@/app/dashboard/w/engine/workspace";
import content from "@/app/dashboard/w/content/workspace";
import opportunity from "@/app/dashboard/w/opportunity/workspace";
import automation from "@/app/dashboard/w/automation/workspace";
import alert from "@/app/dashboard/w/alert/workspace";
import share from "@/app/dashboard/w/share/workspace";
import task from "@/app/dashboard/w/task/workspace";
import team from "@/app/dashboard/w/team/workspace";
import playbook from "@/app/dashboard/w/playbook/workspace";
import integration from "@/app/dashboard/w/integration/workspace";
import siteAudit from "@/app/dashboard/w/site-audit/workspace";
import approval from "@/app/dashboard/w/approval/workspace";
import { register } from "./core";

register(brand);
register(prompt);
register(competitor);
register(campaign);
register(mission);
register(sprint);
register(engine);
register(content);
register(opportunity);
register(automation);
register(alert);
register(share);
register(task);
register(team);
register(playbook);
register(integration);
register(siteAudit);
register(approval);

export {};
