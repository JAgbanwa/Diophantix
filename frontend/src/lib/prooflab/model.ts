import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  AttackPlanSchema,
  ClaimExtractionSchema,
  type AttackPlan,
  type ClaimExtraction,
} from "./contracts";

export const PROOFLAB_MODEL = process.env.OPENAI_PROOFLAB_MODEL?.trim() || "gpt-5.6";

export const CLAIM_COMPILER_PROMPT = `
You compile an informal mathematical claim into one small machine-checkable
obligation. You do not verify the claim and cannot assign a truth or proof
status.

Supported claim types:
- parametric_identity: formulas are claimed to satisfy a polynomial equation
  for every integer parameter value.
- no_integer_solutions: a polynomial equation is claimed to have no integer
  solutions.
- verify_assignment: concrete integer values are claimed to solve an equation.
- unsupported: the claim cannot be represented faithfully above.

The separately supplied equation is authoritative. Preserve every material side
condition in assumptions. Use plain polynomial syntax (** or ^ for powers, *
for multiplication). Put target-variable formulas in substitutions and concrete
integers in assignment. If prose is ambiguous or unsupported, do not invent a
formula: choose unsupported or lower confidence. Explain only what you extracted,
never whether it is correct. ProofLab already quantifies supported variables over
the integers, so do not repeat bare domain declarations such as "t is an integer"
in assumptions. Preserve only additional restrictions such as positivity,
nonzero conditions, parity, coprimality, or inequalities.
`.trim();

export const ATTACK_PLANNER_PROMPT = `
Plan adversarial tests for a Diophantix ProofLab obligation. You may propose
ways to challenge the interpretation, but cannot decide correctness or assign a
proof status. Deterministic code executes every proposed attack.

Choose only from the schema's attack kinds. Prefer directly relevant checks,
especially exact counterexamples, boundary values, complete congruence scans,
unverified assumptions, possible zero division, certificate scope, and bounded
solution search. Give a reason for every check, never a verdict.
`.trim();

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export class ModelRequestError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "ModelRequestError";
    this.code = code;
    this.status = status;
  }
}

function client() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ModelRequestError(
      "OPENAI_API_KEY is not configured on the server. Use a labeled offline demonstration or configure the production environment.",
      "OPENAI_NOT_CONFIGURED",
      503,
    );
  }
  return new OpenAI({ apiKey, maxRetries: 2, timeout: 35_000 });
}

function usageOf(response: { usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | null }): ModelUsage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
  };
}

function normalizeModelError(error: unknown): never {
  if (error instanceof ModelRequestError) throw error;
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined;
  if (status === 429) {
    throw new ModelRequestError("GPT-5.6 is at capacity for this project. Retry shortly or use an offline demonstration.", "MODEL_RATE_LIMITED", 503);
  }
  if (status && status >= 500) {
    throw new ModelRequestError("GPT-5.6 is temporarily unavailable. Retry shortly or use an offline demonstration.", "MODEL_TEMPORARILY_UNAVAILABLE", 503);
  }
  if (typeof error === "object" && error && "name" in error && error.name === "AbortError") {
    throw new ModelRequestError("GPT-5.6 timed out. Retry with a shorter claim.", "MODEL_TIMEOUT", 504);
  }
  throw new ModelRequestError("GPT-5.6 could not compile the claim. Retry without changing your saved work.", "MODEL_REQUEST_FAILED", 502);
}

async function parseStructured<T>({
  system,
  user,
  schema,
  schemaName,
}: {
  system: string;
  user: string;
  schema: typeof ClaimExtractionSchema | typeof AttackPlanSchema;
  schemaName: string;
}): Promise<{ parsed: T; usage: ModelUsage; responseId: string }> {
  try {
    const response = await client().responses.parse({
      model: PROOFLAB_MODEL,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: zodTextFormat(schema, schemaName) },
      max_output_tokens: 1_500,
      store: false,
    });
    if (!response.output_parsed) {
      throw new ModelRequestError("GPT-5.6 returned no valid structured output.", "MODEL_EMPTY_RESPONSE", 502);
    }
    return { parsed: response.output_parsed as T, usage: usageOf(response), responseId: response.id };
  } catch (error) {
    return normalizeModelError(error);
  }
}

export function compileUserPayload(input: { equation: string; claim: string; proposedArgument: string }) {
  return [
    `AUTHORITATIVE EQUATION:\n${input.equation}`,
    `USER CLAIM:\n${input.claim}`,
    `PROPOSED ARGUMENT OR FORMULAS:\n${input.proposedArgument || "(none)"}`,
  ].join("\n\n");
}

export async function compileClaim(input: { equation: string; claim: string; proposedArgument: string }) {
  return parseStructured<ClaimExtraction>({
    system: CLAIM_COMPILER_PROMPT,
    user: compileUserPayload(input),
    schema: ClaimExtractionSchema,
    schemaName: "prooflab_claim_extraction",
  });
}

export async function planAttacks(payload: unknown) {
  return parseStructured<AttackPlan>({
    system: ATTACK_PLANNER_PROMPT,
    user: JSON.stringify(payload),
    schema: AttackPlanSchema,
    schemaName: "prooflab_attack_plan",
  });
}
