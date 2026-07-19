import { describe, it, expect } from "vitest";
import {
  canTransitionTask,
  canTransitionMission,
  applyTaskAction,
  applyMissionAction,
  missionHealth,
  decomposeOpportunity,
  TASK_TRANSITIONS,
} from "./workflow-state";

describe("task state machine", () => {
  it("allows legal transitions", () => {
    expect(canTransitionTask("backlog", "todo")).toBe(true);
    expect(canTransitionTask("todo", "in_progress")).toBe(true);
    expect(canTransitionTask("in_progress", "in_review")).toBe(true);
    expect(canTransitionTask("in_review", "done")).toBe(true);
    expect(canTransitionTask("done", "in_progress")).toBe(true); // reopen
    expect(canTransitionTask("blocked", "in_progress")).toBe(true);
    expect(canTransitionTask("cancelled", "todo")).toBe(true); // restore
  });

  it("rejects illegal transitions", () => {
    expect(canTransitionTask("backlog", "done")).toBe(false);
    expect(canTransitionTask("todo", "done")).toBe(false);
    expect(canTransitionTask("in_progress", "backlog")).toBe(false);
    expect(canTransitionTask("done", "cancelled")).toBe(false);
  });

  it("covers every status in the transition table", () => {
    for (const s of Object.keys(TASK_TRANSITIONS) as (keyof typeof TASK_TRANSITIONS)[]) {
      expect(Array.isArray(TASK_TRANSITIONS[s])).toBe(true);
    }
  });

  it("maps actions to the correct target status, or null when illegal", () => {
    expect(applyTaskAction("backlog", "start")).toBe("todo");
    expect(applyTaskAction("todo", "start")).toBe("in_progress");
    expect(applyTaskAction("in_progress", "submit")).toBe("in_review");
    expect(applyTaskAction("in_review", "complete")).toBe("done");
    expect(applyTaskAction("in_progress", "block")).toBe("blocked");
    expect(applyTaskAction("blocked", "unblock")).toBe("in_progress");
    expect(applyTaskAction("done", "reopen")).toBe("in_progress");
    expect(applyTaskAction("backlog", "complete")).toBeNull(); // illegal from here
    expect(applyTaskAction("backlog", "unblock")).toBeNull();
  });
});

describe("mission state machine", () => {
  it("allows lifecycle transitions", () => {
    expect(canTransitionMission("active", "on_hold")).toBe(true);
    expect(canTransitionMission("active", "completed")).toBe(true);
    expect(canTransitionMission("on_hold", "active")).toBe(true);
    expect(canTransitionMission("completed", "active")).toBe(true); // reopen
  });
  it("rejects illegal mission transitions", () => {
    expect(canTransitionMission("completed", "cancelled")).toBe(false);
    expect(canTransitionMission("cancelled", "on_hold")).toBe(false);
  });
  it("maps mission actions", () => {
    expect(applyMissionAction("active", "hold")).toBe("on_hold");
    expect(applyMissionAction("on_hold", "resume")).toBe("active");
    expect(applyMissionAction("active", "complete")).toBe("completed");
    expect(applyMissionAction("completed", "reopen")).toBe("active");
    expect(applyMissionAction("active", "reopen")).toBeNull();
  });
});

describe("missionHealth rollup", () => {
  it("returns 0% with no tasks", () => {
    const h = missionHealth([]);
    expect(h.percentComplete).toBe(0);
    expect(h.isComplete).toBe(false);
    expect(h.hasBlocked).toBe(false);
  });
  it("computes completion percentage and blocked flag", () => {
    const h = missionHealth([
      { status: "done" },
      { status: "done" },
      { status: "in_progress" },
      { status: "blocked" },
    ]);
    expect(h.total).toBe(4);
    expect(h.done).toBe(2);
    expect(h.percentComplete).toBe(50);
    expect(h.hasBlocked).toBe(true);
    expect(h.isComplete).toBe(false);
  });
  it("marks complete only when all tasks are done", () => {
    expect(missionHealth([{ status: "done" }, { status: "done" }]).isComplete).toBe(true);
    expect(missionHealth([{ status: "done" }, { status: "cancelled" }]).isComplete).toBe(false);
  });
});

describe("decomposeOpportunity", () => {
  it("returns a verify-terminated sequence for every known type", () => {
    for (const type of ["citation_gap", "position_gap", "schema_missing", "competitor_exposure", "intent_coverage"]) {
      const steps = decomposeOpportunity(type, "gap");
      expect(steps.length).toBeGreaterThan(0);
      expect(steps[steps.length - 1].type).toBe("verify");
    }
  });
  it("falls back to fix+verify for unknown types", () => {
    const steps = decomposeOpportunity("mystery", "thing");
    expect(steps[0].type).toBe("fix");
    expect(steps[steps.length - 1].type).toBe("verify");
  });
  it("preserves the opportunity title in each step", () => {
    const steps = decomposeOpportunity("citation_gap", "Win more citations");
    expect(steps.every((s) => s.title.includes("Win more citations"))).toBe(true);
  });
});
