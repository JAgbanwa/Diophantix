import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ContractValidationError, validateAnalysisObligation } from "@/lib/prooflab/contracts";
import { getDemoCase } from "@/lib/prooflab/demo-cases";
import {
  compileClaim,
  ModelRequestError,
  planAttacks,
  PROOFLAB_MODEL,
  type ModelUsage,
} from "@/lib/prooflab/model";
import { lookupLiteratureContext } from "@/lib/prooflab/literature-context";
import { enforceRateLimit, managedLimiterConfigured } from "@/lib/prooflab/rate-limit.mjs";
import {
  buildEvidenceLedger,
  parseEquation,
  polynomialToString,
  ProofLabError,
  replayCertificate,
  runAdversarialChecks,
  sanitizeAttackPlan,
  verifyClaim,
} from "@/lib/prooflab/verifier.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 24_000;
const SERVICE_VERSION = "prooflab-api-3";

type Input = { equation: string; claim: string; proposedArgument: string };
type ModelState = "connected" | "temporarily_unavailable" | "unknown";
type VerifierResult = Record<string, unknown> & {
  status: string;
  title: string;
  summary: string;
  certificate?: Record<string, unknown> | null;
  scope?: string;
  residual?: string;
};

let lastModelState: { state: ModelState; checkedAt: string | null; code: string | null } = {
  state: "unknown",
  checkedAt: null,
  code: null,
};

function requestIdOf(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{8,100}$/.test(supplied) ? supplied : randomUUID();
}

function json(payload: unknown, requestId: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-ProofLab-Request-Id", requestId);
  return NextResponse.json(payload, { ...init, headers });
}

function logEvent(requestId: string, event: string, detail: Record<string, unknown> = {}) {
  console.info(JSON.stringify({
    service: "prooflab",
    version: SERVICE_VERSION,
    requestId,
    event,
    at: new Date().toISOString(),
    ...detail,
  }));
}

function requireText(value: unknown, label: string, maxLength: number, { optional = false } = {}) {
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

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    throw new ProofLabError(`Request body exceeds ${MAX_REQUEST_BYTES.toLocaleString()} bytes.`, "REQUEST_BODY_TOO_LARGE");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    throw new ProofLabError(`Request body exceeds ${MAX_REQUEST_BYTES.toLocaleString()} bytes.`, "REQUEST_BODY_TOO_LARGE");
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value;
  } catch {
    throw new ProofLabError("Request body must be a JSON object.", "INVALID_JSON");
  }
}

function normalizeInput(body: Record<string, unknown>): Input {
  return {
    equation: requireText(body.equation, "Equation", 600),
    claim: requireText(body.claim, "Claim", 2_000),
    proposedArgument: requireText(body.proposedArgument, "Proposed argument", 4_000, { optional: true }),
  };
}

function verifyAndReplay(obligation: Record<string, unknown>) {
  const verification = verifyClaim(obligation) as VerifierResult;
  const replay = verification.certificate ? replayCertificate(verification.certificate) : null;
  if (replay && !replay.valid) {
    throw new ProofLabError(`Internal certificate replay failed: ${replay.reason}`, "INTERNAL_CERTIFICATE_FAILURE");
  }
  return { verification, replay };
}

function learningGuidance(obligation: Record<string, unknown>, verification: Record<string, unknown>) {
  if (verification.status !== "UNKNOWN") return [];
  const guidance = [
    "Treat UNKNOWN as an honest boundary: the available certificate language has not settled the claim.",
  ];
  if (Array.isArray(verification.missingTargets) && verification.missingTargets.length) {
    guidance.push(`Add direct formulas for ${verification.missingTargets.join(", ")} in terms of independent parameters.`);
  }
  if (Array.isArray(verification.dependentSubstitutions) && verification.dependentSubstitutions.length) {
    guidance.push("Rewrite each target formula directly in the independent parameters, without referring to another target variable.");
  }
  if (Array.isArray(obligation.assumptions) && obligation.assumptions.length) {
    guidance.push("Reformulate side conditions as explicit machine-checkable constraints, or remove them only if the claim truly is unconditional.");
  }
  if (obligation.claimType === "unsupported") {
    guidance.push("Try a polynomial identity, a concrete integer assignment, or a no-integer-solutions claim that may admit a congruence obstruction.");
  }
  if (obligation.claimType === "no_integer_solutions") {
    guidance.push("A wider search can add evidence but still cannot prove global non-existence; look for a complete modular obstruction.");
  }
  return guidance;
}

function analysisPayload({
  input,
  obligation,
  verification,
  replay,
  executionMode,
  usage,
  requestId,
  responseId,
}: {
  input: Input;
  obligation: Record<string, unknown>;
  verification: Record<string, unknown>;
  replay: Record<string, unknown> | null;
  executionMode: "gpt-5.6" | "offline_replay";
  usage?: ModelUsage;
  requestId: string;
  responseId?: string;
}) {
  const interpreter = executionMode === "gpt-5.6" ? "GPT-5.6" : "Precompiled demonstration";
  return {
    ok: true,
    mode: "analyze",
    executionMode,
    model: executionMode === "gpt-5.6" ? PROOFLAB_MODEL : null,
    obligation,
    verification,
    evidenceLedger: buildEvidenceLedger(obligation, verification, { interpreter }),
    certificateReplay: replay,
    learningGuidance: learningGuidance(obligation, verification),
    literatureContext: lookupLiteratureContext(input),
    trace: { requestId, modelResponseId: responseId ?? null, usage: usage ?? null },
    policy: {
      modelRole: executionMode === "gpt-5.6"
        ? "GPT-5.6 extracted this obligation; its output cannot contain a proof status."
        : "This labeled fallback used a reviewed, precompiled obligation and made no model request.",
      verifierRole: "Deterministic exact arithmetic alone assigned the displayed status.",
      literatureRole: "A dated, curated source registry may identify a related problem's research status; it cannot assign ProofLab proof status.",
      provedInvariant: "PROVED is unavailable to model output and requires successful certificate replay.",
    },
  };
}

async function analyze(body: Record<string, unknown>, requestId: string) {
  const input = normalizeInput(body);
  const compiled = await compileClaim(input);
  lastModelState = { state: "connected", checkedAt: new Date().toISOString(), code: null };
  const obligation = { ...compiled.parsed, equation: input.equation };
  const { verification, replay } = verifyAndReplay(obligation);
  logEvent(requestId, "analysis.completed", {
    status: verification.status,
    claimType: obligation.claimType,
    model: PROOFLAB_MODEL,
    totalTokens: compiled.usage.totalTokens,
  });
  return analysisPayload({
    input,
    obligation,
    verification,
    replay,
    executionMode: "gpt-5.6",
    usage: compiled.usage,
    requestId,
    responseId: compiled.responseId,
  });
}

function analyzeOffline(body: Record<string, unknown>, requestId: string) {
  const demo = getDemoCase(body.demoId);
  if (!demo) {
    throw new ProofLabError("Offline replay is available only for the three reviewed demonstrations.", "OFFLINE_DEMO_REQUIRED");
  }
  const obligation = { ...demo.obligation, equation: demo.form.equation };
  const { verification, replay } = verifyAndReplay(obligation);
  logEvent(requestId, "offline_replay.completed", { demoId: demo.id, status: verification.status });
  return analysisPayload({ input: demo.form, obligation, verification, replay, executionMode: "offline_replay", requestId });
}

async function attack(body: Record<string, unknown>, requestId: string) {
  const input = normalizeInput(body);
  const { equation: analyzedEquation, ...extraction } = validateAnalysisObligation(body.obligation);
  if (analyzedEquation !== input.equation) {
    throw new ProofLabError("The analyzed obligation no longer matches the submitted equation. Run analysis again before attacking it.", "OBLIGATION_EQUATION_MISMATCH");
  }
  const obligation = { ...extraction, equation: input.equation };
  const verification = verifyClaim(obligation) as VerifierResult;
  const planned = await planAttacks({
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
  lastModelState = { state: "connected", checkedAt: new Date().toISOString(), code: null };
  const applicablePlan = sanitizeAttackPlan(obligation, planned.parsed);
  const adversarialReview = runAdversarialChecks({
    obligation,
    verification,
    proposedArgument: input.proposedArgument,
    proposedAttacks: applicablePlan.attacks,
  });
  logEvent(requestId, "attack.completed", { status: verification.status, issues: adversarialReview.issueCount });
  return {
    ok: true,
    mode: "attack",
    executionMode: "gpt-5.6",
    model: PROOFLAB_MODEL,
    plan: applicablePlan,
    verification,
    adversarialReview,
    trace: { requestId, modelResponseId: planned.responseId, usage: planned.usage },
  };
}

function attackOffline(body: Record<string, unknown>, requestId: string) {
  const demo = getDemoCase(body.demoId);
  if (!demo) throw new ProofLabError("Choose a reviewed demonstration before running an offline attack replay.", "OFFLINE_DEMO_REQUIRED");
  const obligation = { ...demo.obligation, equation: demo.form.equation };
  const verification = verifyClaim(obligation) as VerifierResult;
  const applicablePlan = sanitizeAttackPlan(obligation, demo.attackPlan);
  const adversarialReview = runAdversarialChecks({
    obligation,
    verification,
    proposedArgument: demo.form.proposedArgument,
    proposedAttacks: applicablePlan.attacks,
  });
  logEvent(requestId, "offline_attack.completed", { demoId: demo.id, issues: adversarialReview.issueCount });
  return {
    ok: true,
    mode: "attack",
    executionMode: "offline_replay",
    model: null,
    plan: applicablePlan,
    verification,
    adversarialReview,
    trace: { requestId, modelResponseId: null, usage: null },
  };
}

function validateEquation(body: Record<string, unknown>, requestId: string) {
  const equation = requireText(body.equation, "Equation", 600);
  const polynomial = parseEquation(equation);
  const normalized = polynomialToString(polynomial);
  const variables = [...new Set([...normalized.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map((match) => match[0]))].sort();
  return { ok: true, mode: "validate", normalizedEquation: `${normalized} = 0`, variables, requestId };
}

function replay(body: Record<string, unknown>, requestId: string) {
  const certificate = body.certificate;
  if (!certificate || typeof certificate !== "object" || Array.isArray(certificate)) {
    throw new ProofLabError("A certificate object is required.", "CERTIFICATE_REQUIRED");
  }
  const result = replayCertificate(certificate);
  logEvent(requestId, "certificate.replayed", { valid: result.valid });
  return { ok: true, mode: "replay", replay: result, requestId };
}

function errorResponse(error: unknown, requestId: string) {
  const knownMath = error instanceof ProofLabError;
  const knownContract = error instanceof ContractValidationError;
  const knownModel = error instanceof ModelRequestError;
  const code = knownMath || knownContract || knownModel ? error.code : "INTERNAL_ERROR";
  if (knownModel && code !== "OPENAI_NOT_CONFIGURED") {
    lastModelState = { state: "temporarily_unavailable", checkedAt: new Date().toISOString(), code };
  }
  const status = knownModel
    ? error.status ?? 502
    : code === "RATE_LIMITED"
      ? 429
      : code === "DAILY_BUDGET_REACHED" || code === "RATE_LIMIT_UNAVAILABLE"
        ? 503
        : code === "REQUEST_BODY_TOO_LARGE" || code === "INPUT_TOO_LONG"
          ? 413
          : knownContract
            ? 502
            : knownMath
              ? 400
              : 500;
  const message = knownMath || knownContract || knownModel
    ? error.message
    : "ProofLab encountered an unexpected server error.";
  logEvent(requestId, "request.failed", { code, status });
  return json({ ok: false, error: message, code, requestId }, requestId, { status });
}

export async function GET(request: Request) {
  const requestId = requestIdOf(request);
  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const serviceState = !openaiConfigured
    ? "unconfigured"
    : lastModelState.state === "temporarily_unavailable"
      ? "temporarily_unavailable"
      : "connected";
  return json({
    ok: true,
    service: "Diophantix ProofLab",
    serviceVersion: SERVICE_VERSION,
    model: PROOFLAB_MODEL,
    openaiConfigured,
    serviceState,
    lastModelCheck: lastModelState.checkedAt,
    lastModelCode: lastModelState.code,
    managedRateLimit: managedLimiterConfigured(),
    offlineDemosAvailable: true,
    statusPolicy: "Only deterministic verifiers can return PROVED.",
    requestId,
  }, requestId);
}

export async function POST(request: Request) {
  const requestId = requestIdOf(request);
  try {
    const body = await readJson(request);
    const mode = typeof body.mode === "string" ? body.mode : "analyze";
    if (["analyze", "attack"].includes(mode)) await enforceRateLimit(request);

    const payload = mode === "attack"
      ? await attack(body, requestId)
      : mode === "offline_demo"
        ? analyzeOffline(body, requestId)
        : mode === "offline_attack"
          ? attackOffline(body, requestId)
          : mode === "validate"
            ? validateEquation(body, requestId)
            : mode === "replay"
              ? replay(body, requestId)
              : await analyze(body, requestId);
    return json(payload, requestId);
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
