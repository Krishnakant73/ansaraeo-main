import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { hmacSign, hmacVerify } from "./signing";
import { ApiError } from "./responses";
import { enqueueJob } from "./queue";
import { getInternalLLM } from "@/lib/llm";

// ============================================================
// Phase 2 — AI Trust Engine.
//
// Verification, provenance, trust-scoring. Carries the repo's honesty
// invariant: deterministic checks WIN for literal presence; the LLM is used
// only for the irreducible (soft/sentiment claims) and is reconciled, never
// silently overriding. No verdict is ever faked — if nothing can verify a
// claim, the verdict is "unverifiable". See docs/PHASE2_TRUST_ENGINE.md.
//
// Depends only on Phase 1 seams: enqueueJob (trust_verify), deliverEvent
// (trust.verified), authenticateApiRequest + scope trust:read, ApiError.
// Enables Phase 3: assertTrustAbove() gates agent publish/external-send.
// ============================================================

export type VerificationMethod = "deterministic" | "llm" | "hybrid";
export type Verdict = "verified" | "refuted" | "unverifiable";

export interface ClaimInput {
  claim: string;
  evidenceRefs: string[];
  tenantId: string;
}

export interface TrustProvenance {
  engine?: string;
  model?: string;
  deterministicCheck?: string;
  inputsHash: string;
  ts: string;
}

export interface VerificationResult {
  claimId: string;
  method: VerificationMethod;
  verdict: Verdict;
  score: number; // 0..1
  reasoning: string;
  provenance: TrustProvenance;
  signature: string;
}

// OPENAI model for the LLM verification pass (only when deterministic is inconclusive).
const TRUST_LLM_MODEL = "gpt-4o-mini";
// Inline proof escape hatch: evidenceRefs entries prefixed with this carry the
// exact text a claim is verified against (no fake fact table required).
const EVIDENCE_INLINE_PREFIX = "evidence:";

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Content-addressed claim id: sha256(claim | sorted(evidenceRefs)). Pure. */
export function claimIdFor(claim: string, evidenceRefs: string[]): string {
  const joined = [claim, ...[...evidenceRefs].sort()].join("|");
  return crypto.createHash("sha256").update(joined).digest("hex");
}

/** Literal-presence deterministic check (mention-matcher discipline). Pure. */
export function literalMatch(claim: string, evidenceTexts: string[]): boolean {
  const nc = normalize(claim);
  if (!nc) return false;
  return evidenceTexts.some((t) => normalize(t).includes(nc));
}

export type DeterministicOutcome =
  | { method: "deterministic"; verdict: Verdict; score: number; deterministicCheck: string }
  | { needsLlm: true };

/**
 * Deterministic verification. Only asserts when it can honestly verify/refute:
 *  - no evidence text at all      -> cannot decide (defer)
 *  - claim literally in evidence  -> verified (literal_match), high score
 * Otherwise defer to the LLM (or unverifiable if no key — handled by caller).
 */
export function evaluateDeterministic(claim: string, evidenceTexts: string[]): DeterministicOutcome {
  if (evidenceTexts.length === 0) return { needsLlm: true };
  if (literalMatch(claim, evidenceTexts)) {
    return { method: "deterministic", verdict: "verified", score: 0.92, deterministicCheck: "literal_match" };
  }
  return { needsLlm: true };
}

export function scoreFor(method: VerificationMethod, verdict: Verdict): number {
  if (verdict === "refuted") return 0.1;
  if (verdict === "unverifiable") return method === "deterministic" ? 0.35 : 0.3;
  // verified
  if (method === "deterministic") return 0.92;
  return 0.8; // llm / hybrid
}

function signingKey(): string {
  const k = process.env.TRUST_SIGNING_KEY ?? process.env.ENCRYPTION_KEY;
  if (!k) throw new Error("TRUST_SIGNING_KEY (or ENCRYPTION_KEY) is not set");
  return k;
}

export function signResult(claimId: string, verdict: Verdict, score: number, inputsHash: string): string {
  return hmacSign(signingKey(), `${claimId}|${verdict}|${score}|${inputsHash}`);
}

export function verifySignature(
  claimId: string,
  verdict: Verdict,
  score: number,
  inputsHash: string,
  sig: string
): boolean {
  return hmacVerify(signingKey(), `${claimId}|${verdict}|${score}|${inputsHash}`, sig);
}

/**
 * Resolves evidenceRefs to verifiable text. The only in-repo evidence source
 * today is `citations`, which stores domain/url metadata (no free text), so
 * DB-resolvable refs yield no text. Inline proof is supported via the
 * `evidence:<text>` prefix — an honest escape hatch that lets callers supply
 * the exact text a claim is verified against without a fake fact table. No
 * network fetch, no fabricated evidence.
 */
export async function resolveEvidenceText(
  refs: string[],
  sb: SupabaseClient = createServiceClient()
): Promise<string[]> {
  const texts: string[] = [];
  for (const ref of refs) {
    if (ref.startsWith(EVIDENCE_INLINE_PREFIX)) {
      texts.push(ref.slice(EVIDENCE_INLINE_PREFIX.length));
      continue;
    }
    // Future: resolve citation UUIDs / URLs to text. Today unsupported -> skip
    // honestly (unresolved refs do not contribute to verification).
    void sb;
  }
  return texts;
}

interface LlmVerdict {
  verdict: Verdict;
  reasoning: string;
  confidence: number;
}

async function llmVerify(claim: string, evidenceTexts: string[]): Promise<LlmVerdict> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { verdict: "unverifiable", reasoning: "LLM verification unavailable (OPENAI_API_KEY not set)", confidence: 0 };
  }
  const evidence = evidenceTexts.length
    ? evidenceTexts.map((t, i) => `E${i + 1}: ${t}`).join("\n")
    : "(no evidence text provided)";
  const system =
    "You verify factual claims against evidence. Reply ONLY with strict JSON: " +
    '{"verdict":"verified|refuted|unverifiable","reasoning":"<1 sentence>","confidence":0..1}.';
  const user = `Claim: ${claim}\nEvidence:\n${evidence}`;
  let raw: string;
  try {
    raw = await getInternalLLM().generate({
      system,
      prompt: user,
      json: true,
      model: TRUST_LLM_MODEL,
    });
  } catch (e) {
    return { verdict: "unverifiable", reasoning: `LLM call error: ${(e as Error).message}`, confidence: 0 };
  }
  const content = raw;
  if (!content) return { verdict: "unverifiable", reasoning: "LLM returned empty content", confidence: 0 };
  try {
    const parsed = JSON.parse(content) as Partial<LlmVerdict>;
    const v = parsed.verdict;
    if (v !== "verified" && v !== "refuted" && v !== "unverifiable") {
      return { verdict: "unverifiable", reasoning: "LLM returned invalid verdict", confidence: 0 };
    }
    return {
      verdict: v,
      reasoning: parsed.reasoning ?? "",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    return { verdict: "unverifiable", reasoning: "LLM returned non-JSON", confidence: 0 };
  }
}

export async function verifyClaim(input: ClaimInput, sb: SupabaseClient = createServiceClient()): Promise<VerificationResult> {
  const claimId = claimIdFor(input.claim, input.evidenceRefs);

  // Idempotent: re-verification of the same claim returns the stored record
  // (no duplicate LLM spend).
  const { data: existing } = await sb
    .from("trust_records")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("claim_id", claimId)
    .maybeSingle();
  if (existing) {
    const rec = existing as Record<string, any>;
    return {
      claimId: rec.claim_id,
      method: rec.method,
      verdict: rec.verdict,
      score: Number(rec.score),
      reasoning: rec.reasoning ?? "",
      provenance: rec.provenance,
      signature: rec.signature,
    };
  }

  const evidenceTexts = await resolveEvidenceText(input.evidenceRefs, sb);
  const deterministic = evaluateDeterministic(input.claim, evidenceTexts);

  let method: VerificationMethod;
  let verdict: Verdict;
  let reasoning: string;
  let deterministicCheck: string | undefined;
  let engine: string | undefined;
  let model: string | undefined;

  if (!("needsLlm" in deterministic)) {
    // Deterministic conclusive (literal_match -> verified). LLM never overrides.
    method = deterministic.method;
    verdict = deterministic.verdict;
    reasoning = "Deterministic literal-presence check";
    deterministicCheck = deterministic.deterministicCheck;
  } else {
    // Defer to LLM. Honest: no key -> unverifiable, never faked.
    const llm = await llmVerify(input.claim, evidenceTexts);
    if (llm.verdict === "unverifiable") {
      method = "deterministic";
      verdict = "unverifiable";
      deterministicCheck = "llm_unavailable";
      reasoning = llm.reasoning;
    } else {
      method = "llm";
      verdict = llm.verdict;
      reasoning = llm.reasoning;
      engine = "openai";
      model = TRUST_LLM_MODEL;
    }
  }

  const score = scoreFor(method, verdict);
  const provenance: TrustProvenance = {
    engine,
    model,
    deterministicCheck,
    inputsHash: claimId,
    ts: new Date().toISOString(),
  };
  const signature = signResult(claimId, verdict, score, claimId);

  const { error } = await sb.from("trust_records").insert({
    tenant_id: input.tenantId,
    claim_id: claimId,
    claim: input.claim,
    method,
    verdict,
    score,
    reasoning,
    provenance,
    signature,
  });
  if (error) throw new Error(`verifyClaim persist failed: ${error.message}`);

  return { claimId, method, verdict, score, reasoning, provenance, signature };
}

export async function enqueueVerification(
  input: ClaimInput,
  sb: SupabaseClient = createServiceClient()
): Promise<{ jobId: string }> {
  const { jobId } = await enqueueJob(
    "trust_verify",
    { claim: input.claim, evidenceRefs: input.evidenceRefs, tenantId: input.tenantId },
    { tenantId: input.tenantId },
    sb
  );
  return { jobId };
}

/**
 * Trust gate consumed by Phase 3 (agent publish / external-send). Throws
 * ApiError(422) if the claim's stored trust is below threshold or not verified,
 * ApiError(404) if no record exists. Honest: never assumes trust.
 */
export async function assertTrustAbove(
  claimId: string,
  threshold: number,
  sb: SupabaseClient = createServiceClient()
): Promise<void> {
  const { data, error } = await sb
    .from("trust_records")
    .select("score, verdict")
    .eq("claim_id", claimId)
    .maybeSingle();
  if (error) throw new ApiError(500, "trust_lookup_failed", error.message);
  if (!data) throw new ApiError(404, "trust_not_found", `No trust record for claim ${claimId}`);
  const row = data as { score: number; verdict: string };
  const score = Number(row.score);
  if (row.verdict !== "verified" || score < threshold) {
    throw new ApiError(
      422,
      "trust_below_threshold",
      `Claim ${claimId} trust ${score} is below required ${threshold} (verdict: ${row.verdict})`,
      false
    );
  }
}
