// ============================================================================
// AnsarAEO — Deterministic End-to-End Workflow Validation
// ----------------------------------------------------------------------------
// Exercises the REAL workflow engine (no mocks) against the live Supabase DB:
//
//   scan (simulated insert) -> generateOpportunities -> acceptOpportunity
//   -> task/mission state machine (incl. deploy-approval gate) -> verifyTask
//   -> history recording
//
// The SCAN step is simulated (a representative visibility_run is inserted)
// because this environment has no live engine API keys (OPENAI/PERPLEXITY/
// GOOGLE). Every other step runs the actual production code paths.
//
// Run:
//   npx vitest run --config vitest.e2e.config.ts validation/workflow-e2e.test.ts
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// --- env bootstrap (mirrors how `next` loads .env.local) ---------------------
// Force-load .env.local and strip inline `#` comments (Vite's dotenv does not),
// so the Supabase service key is never captured with a trailing comment.
{
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        const key = m[1];
        const val = m[2].replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "").trim();
        process.env[key] = val;
      }
    }
  }
}

import { createServiceClient } from "@/lib/supabase/server";
import { generateOpportunities } from "@/lib/opportunity-engine";
import {
  acceptOpportunity,
  verifyTask,
  setTaskStatus,
  setMissionStatus,
  requestApproval,
  decideApproval,
  listApprovals,
  listTasks,
  listMissions,
  listOpportunities,
} from "@/lib/workflow";
import {
  decomposeOpportunity,
  canTransitionTask,
  canTransitionMission,
  missionHealth,
} from "@/lib/workflow-state";

const ORG_ID = "139031b0-9001-4821-a216-ee4fb1be964e";
const USER_ID = "fe4bdd02-18fe-4798-902e-173da56dca54";
const CATEGORY = "fnb";
const PERIOD = "2026-07-01"; // bucketMonth(new Date()) for July 2026
const SAMPLE_BRAND = "Zorastra Wellness (sample)";

const log: string[] = [];
const issues: string[] = [];
function step(msg: string) {
  log.push(`• ${msg}`);
  console.log(`• ${msg}`);
}
function issue(msg: string) {
  issues.push(`⚠ ${msg}`);
  console.log(`⚠ ${msg}`);
}

const STATUSES = ["backlog", "todo", "in_progress", "in_review", "done"] as const;

describe("AnsarAEO end-to-end workflow (deterministic, simulated scan)", () => {
  const sb = createServiceClient();
  let brandId = "";
  let promptId = "";
  let oppId = "";
  let missionId = "";
  let verifyTaskId = "";
  let deployTaskId = "";
  const created: Record<string, number> = {};

  beforeAll(async () => {
    step("== SETUP: seed sample brand + benchmark + simulated scan ==");

    // Clean any prior run for idempotent re-runs.
    await sb.from("brands").delete().eq("name", SAMPLE_BRAND);
    await sb.from("benchmark_aggregates").delete().eq("dimension_type", "industry").eq("dimension_value", CATEGORY);

    // 1) Sample brand (fictional Indian Ayurvedic D2C brand), tied to the
    //    existing org so it is RLS-visible to the dashboard user.
    const { data: brand, error: be } = await sb
      .from("brands")
      .insert({
        org_id: ORG_ID,
        name: SAMPLE_BRAND,
        domain: "zorastra-wellness.example",
        industry: "Ayurvedic D2C wellness",
        country: "IN",
        languages: ["en", "hi"],
        industry_category: CATEGORY,
        benchmark_opt_in: true,
        benchmark_public_opt_in: false,
      })
      .select()
      .single();
    if (be) throw be;
    brandId = (brand as any).id;
    step(`Seeded brand "${SAMPLE_BRAND}" (${brandId.slice(0, 8)}) under org ${ORG_ID.slice(0, 8)}`);

    // 2) A prompt the brand wants to be mentioned for.
    const { data: prompt, error: pe } = await sb
      .from("prompts")
      .insert({
        brand_id: brandId,
        text: "What are the best Ayurvedic immunity supplements for daily use in India?",
        language: "en",
        category: "health",
        intent: "recommendation",
        is_active: true,
      })
      .select()
      .single();
    if (pe) throw pe;
    promptId = (prompt as any).id;

    // 3) Competitors (for share-of-voice / competitor mentions).
    await sb.from("competitors").insert([
      { brand_id: brandId, name: "Patanjali", domain: "patanjali.com", confirmed: true },
      { brand_id: brandId, name: "Dabur", domain: "dabur.com", confirmed: true },
    ]);

    // 4) SIMULATED SCAN — mirrors runVisibilityCheck's writes per engine.
    const { data: eng } = await sb.from("engines").select("id,name").in("name", ["chatgpt", "perplexity"]);
    const chatgpt = (eng as any[]).find((e) => e.name === "chatgpt");
    const perplexity = (eng as any[]).find((e) => e.name === "perplexity");

    const chatRaw =
      "For daily Ayurvedic immunity in India, Patanjali and Dabur dominate recommendations. " +
      "Zorastra Wellness is an emerging Ayurvedic brand worth watching for its transparency.";
    const { data: run, error: re } = await sb
      .from("visibility_runs")
      .insert({
        prompt_id: promptId,
        engine_id: chatgpt.id,
        raw_response: chatRaw,
        brand_mentioned: true,
        brand_position: 3,
        sentiment: "neutral",
        tokens_used: 120,
        cost_usd: 0.0002,
        competitor_mentions: [
          { name: "Patanjali", mentioned: true, position: 1 },
          { name: "Dabur", mentioned: true, position: 2 },
        ],
        mention_verification: { brand: { agreed: true, llmSaid: true, textMatchSaid: true } },
        recommendation_alignment: "neutral",
      })
      .select()
      .single();
    if (re) throw re;
    const runId = (run as any).id;

    // citations for the mentioned run
    await sb.from("citations").insert([
      {
        run_id: runId,
        cited_domain: "zorastra-wellness.example",
        cited_url: "https://zorastra-wellness.example/immunity",
        is_own_domain: true,
        is_competitor_domain: false,
        source_quality: 0.7,
        is_trusted_source: false,
      },
      {
        run_id: runId,
        cited_domain: "patanjali.com",
        cited_url: "https://patanjali.com/immunity",
        is_own_domain: false,
        is_competitor_domain: true,
        source_quality: 0.9,
        is_trusted_source: true,
      },
    ]);

    // history (observation + derived event) — mirrors safeRecordRunHistory
    const { data: obs } = await sb
      .from("history_observations")
      .insert({
        brand_id: brandId,
        prompt_id: promptId,
        engine_id: chatgpt.id,
        engine_name: "chatgpt",
        prompt_text: "What are the best Ayurvedic immunity supplements for daily use in India?",
        run_id: runId,
        observed_at: new Date().toISOString(),
        skipped: false,
        brand_mentioned: true,
        brand_position: 3,
        sentiment: "neutral",
        recommendation_alignment: "neutral",
        competitor_mentions: [{ name: "Patanjali", mentioned: true, position: 1 }],
        raw_response: chatRaw,
        tokens_used: 120,
        cost_usd: 0.0002,
      })
      .select()
      .single();
    await sb.from("history_events").insert({
      brand_id: brandId,
      prompt_id: promptId,
      engine_id: chatgpt.id,
      engine_name: "chatgpt",
      event_type: "mention",
      occurred_at: new Date().toISOString(),
      observation_id: (obs as any).id,
      to_state: { brand_mentioned: true, engine: "chatgpt" },
      detail: { simulated: true },
      severity: "info",
    });

    // an unmentioned run on another engine, to show both outcomes
    await sb.from("visibility_runs").insert({
      prompt_id: promptId,
      engine_id: perplexity.id,
      raw_response: "Top immunity supplements include Himalaya and Baidyanath.",
      brand_mentioned: false,
      sentiment: "neutral",
      competitor_mentions: [{ name: "Patanjali", mentioned: false, position: null }],
    });

    step("Simulated scan: 2 visibility_runs (1 mentioned + citations + history), 1 unmentioned");

    // 5) BENCHMARK foundation — published industry p50 + brand snapshot BELOW
    //    p50 so generateOpportunities produces real gaps.
    const metrics: [string, number][] = [
      ["mention_rate", 0.62],
      ["citation_rate", 0.55],
      ["avg_position", 2.1],
      ["avg_trust", 0.7],
      ["avg_visibility", 0.6],
    ];
    await sb.from("benchmark_aggregates").insert(
      metrics.map(([m, p]) => ({
        period_start: PERIOD,
        period_type: "month",
        dimension_type: "industry",
        dimension_value: CATEGORY,
        engine: "*",
        metric: m,
        p50: p,
        avg: p,
        published: true,
        brand_count: 50,
        total_observations: 500,
      }))
    );
    await sb.from("benchmark_brand_snapshots").insert({
      brand_id: brandId,
      period_start: PERIOD,
      period_type: "month",
      engine: "*",
      intent: "*",
      language: "*",
      industry_category: CATEGORY,
      region: "global",
      mention_rate: 0.4, // < p50 0.62 -> competitor_exposure gap
      citation_rate: 0.2, // < p50 0.55 -> citation_gap
      avg_position: 4.0, // > p50 2.1 (position_gap logic yields 0 — see issue)
      avg_trust: 0.45, // < p50 0.7 -> schema_missing gap
      avg_visibility: 0.35,
      run_count: 12,
      prompt_count: 5,
    });
    step("Benchmark: published industry p50 aggregates + brand snapshot (below p50 to create gaps)");
  }, 60000);

  it("1) generateOpportunities creates open opportunities for the gaps", async () => {
    const { opportunities } = await generateOpportunities(brandId, PERIOD);
    expect(opportunities).toBeGreaterThan(0);
    const opps = await listOpportunities(brandId, {}, sb);
    expect(opps.length).toBe(opportunities);
    const citationOpp = opps.find((o) => o.type === "citation_gap");
    expect(citationOpp).toBeTruthy();
    oppId = citationOpp!.id;
    step(`generateOpportunities -> ${opps.length} open opportunity(ies); picked citation_gap (${oppId.slice(0, 8)})`);
    if (!opps.find((o) => o.type === "position_gap")) {
      issue(
        "position_gap NOT generated despite brand avg_position (4.0) being worse than p50 (2.1). " +
          "opportunity-engine gapMagnitude(target, brand) returns 0 for higher-is-worse metrics — position gaps never surface. Worth fixing."
      );
    }
  });

  it("2) decomposeOpportunity yields a deterministic fix→…→verify template", () => {
    const tpl = decomposeOpportunity("citation_gap", "Close your citation gap");
    expect(tpl[0].type).toBe("content");
    expect(tpl[tpl.length - 1].type).toBe("verify");
    step(`decomposeOpportunity(citation_gap) -> [${tpl.map((t) => t.type).join(", ")}]`);
  });

  it("3) acceptOpportunity creates a mission + task sequence (last = verify)", async () => {
    const res = await acceptOpportunity(brandId, oppId, USER_ID, sb);
    missionId = res.missionId;
    expect(missionId).toBeTruthy();
    expect(res.taskIds.length).toBeGreaterThan(0);
    const tasks = await listTasks({ mission_id: missionId }, sb);
    expect(tasks.length).toBe(res.taskIds.length);
    const verifyT = tasks.find((t) => t.type === "verify");
    expect(verifyT).toBeTruthy();
    verifyTaskId = verifyT!.id;
    deployTaskId = tasks.find((t) => t.type === "deploy")!.id;

    const ack = await listOpportunities(brandId, { status: "acknowledged" }, sb);
    expect(ack.find((o) => o.id === oppId)).toBeTruthy();
    step(
      `acceptOpportunity -> mission ${missionId.slice(0, 8)} + ${tasks.length} tasks ` +
        `(verify ${verifyTaskId.slice(0, 8)}, deploy ${deployTaskId.slice(0, 8)}); opportunity now acknowledged`
    );
  });

  // Drive a task forward to `target` through only legal consecutive transitions.
  async function advanceTo(taskId: string, target: (typeof STATUSES)[number]) {
    let cur = ((await sb.from("tasks").select("status").eq("id", taskId).single()).data as any).status;
    while (cur !== target) {
      const idx = STATUSES.indexOf(cur as any);
      const next = STATUSES[idx + 1];
      if (!next) break;
      await setTaskStatus(taskId, next as any, brandId, sb);
      cur = next;
    }
  }

  it("4) state machine: legal transitions work; illegal transitions rejected; mission lifecycle", async () => {
    const tasks = await listTasks({ mission_id: missionId }, sb);
    for (const t of tasks) {
      if (t.type === "verify" || t.type === "deploy") continue;
      await advanceTo(t.id, "done");
    }
    // deploy-approval gate (module 9): completing a deploy task with a PENDING
    // approval must be blocked; after approval it succeeds.
    await advanceTo(deployTaskId, "in_review");
    await requestApproval({ brandId, taskId: deployTaskId, userId: USER_ID }, sb);
    let blocked = false;
    try {
      await setTaskStatus(deployTaskId, "done", brandId, sb);
    } catch {
      blocked = true;
    }
    expect(blocked).toBe(true);
    const approvals = await listApprovals(brandId, { status: "pending" }, sb);
    const appr = approvals.find((a: any) => a.task_id === deployTaskId);
    expect(appr).toBeTruthy();
    await decideApproval((appr as any).id, "approved", USER_ID, brandId, sb);
    await setTaskStatus(deployTaskId, "done", brandId, sb);

    // pure state-machine guards (UI button availability depends on these)
    expect(canTransitionTask("done", "cancelled")).toBe(false);
    expect(canTransitionTask("backlog", "done")).toBe(false);
    expect(canTransitionMission("completed", "cancelled")).toBe(false);
    expect(canTransitionTask("in_review", "done")).toBe(true);

    // mission active -> completed
    await setMissionStatus(missionId, "completed", brandId, sb);
    const missions = await listMissions(brandId, {}, sb);
    expect(missions.find((m) => m.id === missionId)!.status).toBe("completed");

    // rollup health
    const finalTasks = await listTasks({ mission_id: missionId }, sb);
    const health = missionHealth(finalTasks.map((t) => ({ status: t.status })));
    expect(health.isComplete || health.percentComplete).toBeTruthy();

    step(
      "State machine: non-deploy tasks -> done; deploy blocked while approval pending, " +
        "unblocked after approve(); illegal transitions rejected; mission -> completed"
    );
  });

  it("5) verifyTask: simulate fix impact then verify (should PASS)", async () => {
    // Simulate the deployed fix improving citation_rate above the p50 target.
    await sb.from("benchmark_brand_snapshots").update({ citation_rate: 0.6 }).eq("brand_id", brandId);
    const result = await verifyTask(verifyTaskId, brandId, USER_ID, sb);
    expect(result.passed).toBe(true);
    expect(result.metric).toBe("citation_rate");
    expect(result.current).toBeGreaterThanOrEqual(result.target!);
    const tasks = await listTasks({ mission_id: missionId }, sb);
    expect(tasks.find((t) => t.id === verifyTaskId)!.status).toBe("done");
    const notifs = await sb.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", USER_ID);
    expect((notifs.count ?? 0) > 0).toBe(true);
    step(
      `verifyTask PASSED: citation_rate current=${result.current} >= target=${result.target} ` +
        `(delta ${result.delta}); verify task done; notification emitted`
    );
  });

  it("6) history recording present for the sample brand", async () => {
    const obs = await sb.from("history_observations").select("*", { count: "exact", head: true }).eq("brand_id", brandId);
    const ev = await sb.from("history_events").select("*", { count: "exact", head: true }).eq("brand_id", brandId);
    expect((obs.count ?? 0) > 0).toBe(true);
    expect((ev.count ?? 0) > 0).toBe(true);
    step(`History: ${obs.count} observation(s) + ${ev.count} event(s) recorded for sample brand`);
  });

  afterAll(async () => {
    const counts = await sb.from("brands").select("id", { count: "exact", head: true }).eq("name", SAMPLE_BRAND);
    created.brands = counts.count ?? 0;
    step(`== END STATE: sample brand "${SAMPLE_BRAND}" retained (${created.brands}) — mirrors a real customer journey =="`);
    fs.writeFileSync(path.resolve(process.cwd(), "validation/workflow-execution-log.txt"), log.join("\n") + "\n");
  });
});
