import { ATTACK_KINDS, ProofLabError } from "./verifier.mjs";

const CLAIM_TYPES = [
  "parametric_identity",
  "no_integer_solutions",
  "verify_assignment",
  "unsupported",
];

const RECOMMENDED_CHECKS = [
  "symbolic_identity",
  "counterexample_search",
  "congruence_obstruction",
  "exact_assignment",
  "assumption_audit",
];

export const CLAIM_EXTRACTION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: [
    "claimType",
    "parameters",
    "substitutions",
    "assignment",
    "assumptions",
    "recommendedChecks",
    "interpretation",
    "confidence",
  ],
  properties: {
    claimType: { type: "string", enum: CLAIM_TYPES },
    parameters: {
      type: "array",
      maxItems: 8,
      items: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
    },
    substitutions: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["variable", "expression"],
        properties: {
          variable: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
          expression: { type: "string", minLength: 1, maxLength: 600 },
        },
      },
    },
    assignment: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["variable", "value"],
        properties: {
          variable: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
          value: { type: "integer" },
        },
      },
    },
    assumptions: {
      type: "array",
      maxItems: 12,
      items: { type: "string", minLength: 1, maxLength: 240 },
    },
    recommendedChecks: {
      type: "array",
      maxItems: 5,
      items: { type: "string", enum: RECOMMENDED_CHECKS },
    },
    interpretation: { type: "string", minLength: 1, maxLength: 800 },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
});

export const ATTACK_PLAN_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["attacks", "focus"],
  properties: {
    attacks: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "reason"],
        properties: {
          kind: { type: "string", enum: ATTACK_KINDS },
          reason: { type: "string", minLength: 1, maxLength: 300 },
        },
      },
    },
    focus: { type: "string", minLength: 1, maxLength: 500 },
  },
});

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function requirePlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProofLabError(`${label} must be an object.`, "MODEL_SCHEMA_ERROR");
  }
}

function requireIdentifier(value, label) {
  if (typeof value !== "string" || !IDENTIFIER_RE.test(value)) {
    throw new ProofLabError(`${label} is not a valid variable name.`, "MODEL_SCHEMA_ERROR");
  }
  return value;
}

function requireString(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new ProofLabError(`${label} must be a non-empty string of at most ${maxLength} characters.`, "MODEL_SCHEMA_ERROR");
  }
  return value.trim();
}

function requireArray(value, label, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ProofLabError(`${label} must be an array with at most ${maxItems} items.`, "MODEL_SCHEMA_ERROR");
  }
  return value;
}

export function validateClaimExtraction(value) {
  requirePlainObject(value, "GPT claim extraction");
  if (!CLAIM_TYPES.includes(value.claimType)) {
    throw new ProofLabError("GPT returned an unsupported claimType.", "MODEL_SCHEMA_ERROR");
  }

  const parameters = requireArray(value.parameters, "parameters", 8).map((item, index) =>
    requireIdentifier(item, `parameters[${index}]`),
  );
  const substitutions = requireArray(value.substitutions, "substitutions", 8).map((item, index) => {
    requirePlainObject(item, `substitutions[${index}]`);
    return {
      variable: requireIdentifier(item.variable, `substitutions[${index}].variable`),
      expression: requireString(item.expression, `substitutions[${index}].expression`, 600),
    };
  });
  if (new Set(substitutions.map((item) => item.variable)).size !== substitutions.length) {
    throw new ProofLabError("substitutions contains duplicate target variables.", "MODEL_SCHEMA_ERROR");
  }
  const assignment = requireArray(value.assignment, "assignment", 8).map((item, index) => {
    requirePlainObject(item, `assignment[${index}]`);
    requireIdentifier(item.variable, `assignment[${index}].variable`);
    if (!Number.isSafeInteger(item.value)) {
      throw new ProofLabError(`assignment[${index}].value must be a safe integer.`, "MODEL_SCHEMA_ERROR");
    }
    return { variable: item.variable, value: item.value };
  });
  if (new Set(assignment.map((item) => item.variable)).size !== assignment.length) {
    throw new ProofLabError("assignment contains duplicate variables.", "MODEL_SCHEMA_ERROR");
  }
  const assumptions = requireArray(value.assumptions, "assumptions", 12).map((item, index) =>
    requireString(item, `assumptions[${index}]`, 240),
  );
  const recommendedChecks = requireArray(value.recommendedChecks, "recommendedChecks", 5).map((item) => {
    if (!RECOMMENDED_CHECKS.includes(item)) {
      throw new ProofLabError(`Unknown recommended check “${item}”.`, "MODEL_SCHEMA_ERROR");
    }
    return item;
  });
  const interpretation = requireString(value.interpretation, "interpretation", 800);
  if (!["high", "medium", "low"].includes(value.confidence)) {
    throw new ProofLabError("confidence must be high, medium, or low.", "MODEL_SCHEMA_ERROR");
  }

  return {
    claimType: value.claimType,
    parameters: [...new Set(parameters)],
    substitutions,
    assignment,
    assumptions,
    recommendedChecks: [...new Set(recommendedChecks)],
    interpretation,
    confidence: value.confidence,
  };
}

export function validateAttackPlan(value) {
  requirePlainObject(value, "GPT attack plan");
  const attacks = requireArray(value.attacks, "attacks", 5).map((item, index) => {
    requirePlainObject(item, `attacks[${index}]`);
    if (!ATTACK_KINDS.includes(item.kind)) {
      throw new ProofLabError(`Unknown attack kind “${item.kind}”.`, "MODEL_SCHEMA_ERROR");
    }
    return {
      kind: item.kind,
      reason: requireString(item.reason, `attacks[${index}].reason`, 300),
    };
  });
  if (attacks.length === 0) throw new ProofLabError("GPT attack plan is empty.", "MODEL_SCHEMA_ERROR");
  return {
    attacks,
    focus: requireString(value.focus, "focus", 500),
  };
}
