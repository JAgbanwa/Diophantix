import { z } from "zod";

export const CLAIM_TYPES = [
  "parametric_identity",
  "no_integer_solutions",
  "verify_assignment",
  "unsupported",
] as const;

export const RECOMMENDED_CHECKS = [
  "symbolic_identity",
  "counterexample_search",
  "congruence_obstruction",
  "exact_assignment",
  "assumption_audit",
] as const;

export const ATTACK_KINDS = [
  "counterexample_search",
  "boundary_values",
  "congruence_scan",
  "assumption_audit",
  "zero_division_audit",
  "scope_audit",
  "bounded_solution_search",
] as const;

const Identifier = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

export const ClaimExtractionSchema = z.object({
  claimType: z.enum(CLAIM_TYPES),
  parameters: z.array(Identifier).max(8),
  substitutions: z.array(z.object({
    variable: Identifier,
    expression: z.string().trim().min(1).max(600),
  }).strict()).max(8),
  assignment: z.array(z.object({
    variable: Identifier,
    value: z.number().int().safe(),
  }).strict()).max(8),
  assumptions: z.array(z.string().trim().min(1).max(240)).max(12),
  recommendedChecks: z.array(z.enum(RECOMMENDED_CHECKS)).max(5),
  interpretation: z.string().trim().min(1).max(800),
  confidence: z.enum(["high", "medium", "low"]),
}).strict().superRefine((value, context) => {
  const substitutionNames = value.substitutions.map((item) => item.variable);
  if (new Set(substitutionNames).size !== substitutionNames.length) {
    context.addIssue({ code: "custom", path: ["substitutions"], message: "Duplicate target variables are not allowed." });
  }
  const assignmentNames = value.assignment.map((item) => item.variable);
  if (new Set(assignmentNames).size !== assignmentNames.length) {
    context.addIssue({ code: "custom", path: ["assignment"], message: "Duplicate assignment variables are not allowed." });
  }
});

export const AttackPlanSchema = z.object({
  attacks: z.array(z.object({
    kind: z.enum(ATTACK_KINDS),
    reason: z.string().trim().min(1).max(300),
  }).strict()).min(1).max(5),
  focus: z.string().trim().min(1).max(500),
}).strict();

export type ClaimExtraction = z.infer<typeof ClaimExtractionSchema>;
export type AttackPlan = z.infer<typeof AttackPlanSchema>;

export class ContractValidationError extends Error {
  code = "MODEL_SCHEMA_ERROR";
  issues: z.core.$ZodIssue[];

  constructor(message: string, issues: z.core.$ZodIssue[]) {
    super(message);
    this.name = "ContractValidationError";
    this.issues = issues;
  }
}

function parseContract<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  const field = first?.path.length ? `${first.path.join(".")}: ` : "";
  throw new ContractValidationError(`${label} is invalid. ${field}${first?.message ?? "Schema validation failed."}`, result.error.issues);
}

export function validateClaimExtraction(value: unknown): ClaimExtraction {
  return parseContract(ClaimExtractionSchema, value, "GPT claim extraction");
}

export function validateAttackPlan(value: unknown): AttackPlan {
  return parseContract(AttackPlanSchema, value, "GPT attack plan");
}
