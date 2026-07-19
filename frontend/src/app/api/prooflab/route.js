import OpenAI from "openai";
import { NextResponse } from "next/server";

import {
  buildEvidenceLedger,
  ProofLabError,
  replayCertificate,
  runAdversarialChecks,
  verifyClaim,
} from "@/lib/prooflab/verifier.mjs";
import {
  ATTACK_PLAN_SCHEMA,
  CLAIM_EXTRACTION_SCHEMA,
  validateAttackPlan,
  validateClaimExtraction,
} from "@/lib/prooflab/schemas.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_PROOFLAB_MODEL?.trim() || "gpt-5.6";
const REQUEST_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_LIMIT = 12;
const requestBuckets = new Map();

const CLAIM_COMPILER_PROMPT = `
You are the claim compiler for Diophantix ProofLab. You translate informal
mathematical claims into a small machine-checkable schema. You are NOT the
verifier and must never judge whether a claim is true, false, proved, or
disproved.

Available claim types:
- parametric_identity: the user gives formulas such as x=t^2-1, y=2t, z=t^2+1
  and claims they satisfy the supplied polynomial equation for every integer
  parameter value.
- no_integer_solutions: the user claims the supplied polynomial equation has no
  integer solutions.
- verify_assignment: the user gives a concrete integer value for every variable
  and claims it is a solution.
- unsupported: anything that cannot be faithfully represented above.

Rules:
1. Extract, do not prove. Never emit a proof status or truth value.
2. The separately supplied equation is authoritative. Do not rewrite its
   mathematical meaning.
3. Use plain polynomial syntax: ** or ^ for powers, * for multiplication.
4. For parametric_identity, put each target-variable formula in substitutions.
5. For verify_assignment, put concrete integers in assignment.
6. Preserve material side conditions in assumptions. Do not silently discard
   positivity, nonzero, coprimality, divisibility, or range restrictions.
7. If the prose is ambiguous, choose unsupported or lower confidence rather
   than inventing a formula.
8. recommendedChecks may only name checks represented in the schema.
9. interpretation should briefly state what you extracted, without assessing
   correctness.
`.trim();

const ATTACK_PLANNER_PROMPT = `
You are the adversarial test planner for Diophantix ProofLab. You may propose
ways to challenge an argument, but you may not decide whether the argument is
correct and may not assign a proof status. Deterministic code executes every
attack.

Choose only from these tools:
- counterexample_search: construct or seek an exact counterexample.
- boundary_values: test zero, signs, and small boundary parameters.
- congruence_scan: exhaust residue classes modulo small moduli.
- assumption_audit: identify assumptions that are not machine checked.
- zero_division_audit: look for cancellation or division by a possibly-zero term.
- scope_audit: check whether the conclusion exceeds the certificate's scope.
- bounded_solution_search: exhaust a small integer box for a claimed non-existence result.

Prefer attacks that are directly relevant. Give reasons, not verdicts.
`.trim();

function getClientAddress(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"
  );
}

function enforceRateLimit(request) {
  const now = Date.now();
  const key = getClientAddress(request);
  const existing = requestBuckets.get(key);
  if (!existing || now - existing.startedAt >= REQUEST_WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  existing.count += 1;
  if (existing.count > REQUEST_LIMIT) {
    throw new ProofLabError(
      "ProofLab request limit reached. Retry after the current five-minute window.",
      "RATE_LIMITED",
    );
  }
  if (requestBuckets.size > 2_000) {
    for (const [bucketKey, bucket] of requestBuckets) {
      if (now - bucket.startedAt >= REQUEST_WINDOW_MS) requestBuckets.delete(bucketKey);
    }
  }
}

function requireText(value, label, maxLength, { optional = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (optional) return "";
    throw new ProofLabError(`${label} is required.`);
  }
  if (typeof value !== "string") throw new ProofLabError(`${label} must be text.`);
  const normalized = value.trim();
  if (!normalized && !optional) throw new ProofLabError(`${label} is required.`);
  if (normalized.length > maxLength) {
    throw new ProofLabError(`${label} exceeds the ${maxLength}-character limit.`, "INPUT_TOO_LONG");
  }
  return normalized;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new ProofLabError("Request body must be valid JSON.");
  }
}

async function callStructuredModel({ system, user, schema, schemaName, signal }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ProofLabError(
      "OPENAI_API_KEY is not configured on the server. Add it to the deployment environment to enable GPT-5.6 claim compilation.",
      "OPENAI_NOT_CONFIGURED",
    );
  }

  const client = new OpenAI({ apiKey });
  const response = await client.responses.create(
    {
      model: MODEL,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
      max_output_tokens: 1_500,
      store: false,
    },
    { signal },
  );

  if (!response.output_text) {
    throw new ProofLabError("GPT-5.6 returned no structured output.", "MODEL_EMPTY_RESPONSE");
  }
  try {
    return JSON.parse(response.output_text);
  } catch {
    throw new ProofLabError("GPT-5.6 returned malformed JSON despite the structured-output request.", "MODEL_SCHEMA_ERROR");
  }
}

async function withModelTimeout(task, timeoutMs = 35_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await task(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ProofLabError("GPT-5.6 request timed out. Retry with a shorter claim.", "MODEL_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function safeErrorResponse(error) {
  const known = error instanceof ProofLabError;
  const code = known ? error.code : "INTERNAL_ERROR";
  const status = code === "RATE_LIMITED"
    ? 429
    : code === "OPENAI_NOT_CONFIGURED"
      ? 503
      : code.startsWith("MODEL_")
        ? 502
        : known
          ? 400
          : 500;
  return NextResponse.json(
    {
      ok: false,
      error: known ? error.message : "ProofLab encountered an unexpected server error.",
      code,
    },
    { status },
  );
}

function normalizeInput(body) {
  return {
    equation: requireText(body.equation, "Equation", 600),
    claim: requireText(body.claim, "Claim", 2_000),
    proposedArgument: requireText(body.proposedArgument, "Proposed argument", 4_000, { optional: true }),
  };
}

function compileUserPayload(input) {
  return [
    `AUTHORITATIVE EQUATION:\n${input.equation}`,
    `USER CLAIM:\n${input.claim}`,
    input.proposedArgument ? `PROPOSED ARGUMENT OR FORMULAS:\n${input.proposedArgument}` : "PROPOSED ARGUMENT OR FORMULAS:\n(none)",
  ].join("\n\n");
}

async function analyze(request, body) {
  const input = normalizeInput(body);
  const rawExtraction = await withModelTimeout((signal) => callStructuredModel({
    system: CLAIM_COMPILER_PROMPT,
    user: compileUserPayload(input),
    schema: CLAIM_EXTRACTION_SCHEMA,
    schemaName: "prooflab_claim_extraction",
    signal,
  }));
  const extraction = validateClaimExtraction(rawExtraction);

  // The user's equation, not the model's interpretation, is the verifier input.
  const obligation = { ...extraction, equation: input.equation };
  const verification = verifyClaim(obligation);
  const replay = verification.certificate ? replayCertificate(verification.certificate) : null;
  if (replay && !replay.valid) {
    throw new ProofLabError(`Internal certificate replay failed: ${replay.reason}`, "INTERNAL_CERTIFICATE_FAILURE");
  }

  return NextResponse.json({
    ok: true,
    mode: "analyze",
    model: MODEL,
    obligation,
    verification,
    evidenceLedger: buildEvidenceLedger(obligation, verification),
    certificateReplay: replay,
    policy: {
      modelRole: "GPT-5.6 interprets the claim and recommends checks.",
      verifierRole: "Deterministic exact arithmetic alone assigns the final status.",
      provedInvariant: "PROVED is unavailable to model output and requires a replayable certificate.",
    },
  });
}

async function attack(request, body) {
  const input = normalizeInput(body);
  const extraction = validateClaimExtraction(body.obligation);
  const obligation = { ...extraction, equation: input.equation };
  const verification = verifyClaim(obligation);

  const plannerPayload = JSON.stringify({
    equation: input.equation,
    claim: input.claim,
    proposedArgument: input.proposedArgument,
    obligation,
    deterministicResult: {
      status: verification.status,
      title: verification.title,
      summary: verification.summary,
      scope: verification.scope ?? null,
      residual: verification.residual ?? null,
      assumptions: obligation.assumptions,
    },
  });

  const rawPlan = await withModelTimeout((signal) => callStructuredModel({
    system: ATTACK_PLANNER_PROMPT,
    user: plannerPayload,
    schema: ATTACK_PLAN_SCHEMA,
    schemaName: "prooflab_attack_plan",
    signal,
  }));
  const plan = validateAttackPlan(rawPlan);
  const adversarialReview = runAdversarialChecks({
    obligation,
    verification,
    proposedArgument: input.proposedArgument,
    proposedAttacks: plan.attacks,
  });

  return NextResponse.json({
    ok: true,
    mode: "attack",
    model: MODEL,
    plan,
    verification,
    adversarialReview,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Diophantix ProofLab",
    model: MODEL,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    statusPolicy: "Only deterministic verifiers can return PROVED.",
  });
}

export async function POST(request) {
  try {
    enforceRateLimit(request);
    const body = await readJson(request);
    const mode = body.mode === "attack" ? "attack" : "analyze";
    return mode === "attack" ? await attack(request, body) : await analyze(request, body);
  } catch (error) {
    return safeErrorResponse(error);
  }
}
