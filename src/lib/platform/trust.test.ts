import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createMockSupabase } from "./__fixtures__/mockSupabase";
import {
  claimIdFor,
  literalMatch,
  evaluateDeterministic,
  scoreFor,
  signResult,
  verifySignature,
  verifyClaim,
  assertTrustAbove,
  enqueueVerification,
  type Verdict,
} from "./trust";

const SIGNING_KEY = "0".repeat(64);

describe("trust — pure helpers", () => {
  beforeEach(() => vi.stubEnv("TRUST_SIGNING_KEY", SIGNING_KEY));
  afterEach(() => vi.unstubAllEnvs());

  it("claimIdFor is content-addressed and order-independent", () => {
    const a = claimIdFor("price is ₹499", ["e1", "e2"]);
    const b = claimIdFor("price is ₹499", ["e2", "e1"]); // reordered refs
    const c = claimIdFor("price is ₹499", ["e1"]); // different refs
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("literalMatch detects claim presence (normalized)", () => {
    expect(literalMatch("Our price is ₹499", ["See: Our price is ₹499 today."])).toBe(true);
    expect(literalMatch("Our price is ₹499", ["Nothing relevant here."])).toBe(false);
  });

  it("evaluateDeterministic returns verified on literal match, defers otherwise", () => {
    const hit = evaluateDeterministic("claim X", ["body contains claim X"]);
    expect("needsLlm" in hit).toBe(false);
    if (!("needsLlm" in hit)) {
      expect(hit).toEqual({ method: "deterministic", verdict: "verified", score: 0.92, deterministicCheck: "literal_match" });
    }
    expect(evaluateDeterministic("claim X", [])).toEqual({ needsLlm: true });
    expect(evaluateDeterministic("claim X", ["unrelated"])).toEqual({ needsLlm: true });
  });

  it("scoreFor maps method+verdict honestly", () => {
    expect(scoreFor("deterministic", "verified" as Verdict)).toBe(0.92);
    expect(scoreFor("llm", "verified" as Verdict)).toBe(0.8);
    expect(scoreFor("llm", "refuted" as Verdict)).toBe(0.1);
    expect(scoreFor("deterministic", "unverifiable" as Verdict)).toBe(0.35);
    expect(scoreFor("llm", "unverifiable" as Verdict)).toBe(0.3);
  });

  it("signResult round-trips and detects tamper", () => {
    const sig = signResult("cid", "verified", 0.92, "cid");
    expect(verifySignature("cid", "verified", 0.92, "cid", sig)).toBe(true);
    expect(verifySignature("cid", "refuted", 0.92, "cid", sig)).toBe(false);
  });
});

describe("trust — verifyClaim", () => {
  let mock = createMockSupabase();
  beforeEach(() => {
    mock = createMockSupabase();
    vi.stubEnv("TRUST_SIGNING_KEY", SIGNING_KEY);
    vi.stubEnv("OPENAI_API_KEY", ""); // default: no LLM
  });
  afterEach(() => vi.unstubAllEnvs());

  it("deterministic literal match verifies without LLM and persists", async () => {
    const input = {
      claim: "Our price is ₹499",
      evidenceRefs: ["evidence: Our price is ₹499 — confirmed on pricing page"],
      tenantId: "org1",
    };
    const r = await verifyClaim(input, mock.client);
    expect(r.method).toBe("deterministic");
    expect(r.verdict).toBe("verified");
    expect(r.score).toBe(0.92);
    expect(r.provenance.deterministicCheck).toBe("literal_match");
    const rows = mock.tables["trust_records"];
    expect(rows).toHaveLength(1);
    expect(rows[0].verdict).toBe("verified");
  });

  it("is idempotent — second call returns stored record, no duplicate row", async () => {
    const input = {
      claim: "Our price is ₹499",
      evidenceRefs: ["evidence: Our price is ₹499 — confirmed on pricing page"],
      tenantId: "org1",
    };
    const first = await verifyClaim(input, mock.client);
    const second = await verifyClaim(input, mock.client);
    expect(second).toEqual(first);
    expect(mock.tables["trust_records"]).toHaveLength(1);
  });

  it("honest unverifiable when no evidence and no LLM key", async () => {
    const r = await verifyClaim({ claim: "soft claim", evidenceRefs: [], tenantId: "org1" }, mock.client);
    expect(r.verdict).toBe("unverifiable");
    expect(r.method).toBe("deterministic");
    expect(r.provenance.deterministicCheck).toBe("llm_unavailable");
    expect(r.score).toBe(0.35);
  });

  it("uses LLM when deterministic is inconclusive and key is present", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ verdict: "verified", reasoning: "matches", confidence: 0.9 }) } }] }),
      }))
    );
    const r = await verifyClaim({ claim: "soft claim", evidenceRefs: ["someRef"], tenantId: "org1" }, mock.client);
    expect(r.method).toBe("llm");
    expect(r.verdict).toBe("verified");
    expect(r.score).toBe(0.8);
    expect(r.provenance.engine).toBe("openai");
    vi.unstubAllGlobals();
  });

  it("enqueueVerification enqueues a trust_verify job", async () => {
    const { jobId } = await enqueueVerification({ claim: "c", evidenceRefs: [], tenantId: "org1" }, mock.client);
    expect(jobId).toBeTruthy();
    const jobs = mock.tables["jobs"];
    expect(jobs).toHaveLength(1);
    expect(jobs[0].type).toBe("trust_verify");
    expect(jobs[0].tenant_id).toBe("org1");
  });
});

describe("trust — assertTrustAbove (Phase 3 gate)", () => {
  let mock = createMockSupabase();
  beforeEach(() => {
    mock = createMockSupabase();
  });

  it("allows when verified and score >= threshold", async () => {
    mock.tables["trust_records"] = [
      { claim_id: "c1", score: 0.95, verdict: "verified" },
    ];
    await expect(assertTrustAbove("c1", 0.9, mock.client)).resolves.toBeUndefined();
  });

  it("blocks when score below threshold (422 trust_below_threshold)", async () => {
    mock.tables["trust_records"] = [
      { claim_id: "c1", score: 0.5, verdict: "verified" },
    ];
    await expect(assertTrustAbove("c1", 0.9, mock.client)).rejects.toMatchObject({
      status: 422,
      code: "trust_below_threshold",
    });
  });

  it("blocks non-verified verdicts even with high score", async () => {
    mock.tables["trust_records"] = [
      { claim_id: "c1", score: 0.95, verdict: "unverifiable" },
    ];
    await expect(assertTrustAbove("c1", 0.9, mock.client)).rejects.toMatchObject({
      status: 422,
      code: "trust_below_threshold",
    });
  });

  it("404 when no record exists", async () => {
    await expect(assertTrustAbove("missing", 0.9, mock.client)).rejects.toMatchObject({
      status: 404,
      code: "trust_not_found",
    });
  });
});
