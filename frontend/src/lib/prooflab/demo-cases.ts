import type { AttackPlan, ClaimExtraction } from "./contracts";

export type DemoCase = {
  id: "false-family" | "true-identity" | "modular-impossibility";
  name: string;
  description: string;
  learningPrompt: string;
  form: {
    equation: string;
    claim: string;
    proposedArgument: string;
  };
  obligation: ClaimExtraction;
  attackPlan: AttackPlan;
};

export const PROOFLAB_DEMOS: readonly DemoCase[] = [
  {
    id: "false-family",
    name: "False family",
    description: "An exact residual and counterexample should refute it.",
    learningPrompt: "Predict whether one tested value is enough to disprove a universal claim.",
    form: {
      equation: "x^2 + y^2 = z^2",
      claim: "For every integer t, these formulas produce a Pythagorean triple.",
      proposedArgument: "x = t^2 + 1\ny = 2*t\nz = t^2 - 1",
    },
    obligation: {
      claimType: "parametric_identity",
      parameters: ["t"],
      substitutions: [
        { variable: "x", expression: "t^2 + 1" },
        { variable: "y", expression: "2*t" },
        { variable: "z", expression: "t^2 - 1" },
      ],
      assignment: [],
      assumptions: [],
      recommendedChecks: ["symbolic_identity", "counterexample_search"],
      interpretation: "The formulas claim to satisfy the Pythagorean equation for every integer t.",
      confidence: "high",
    },
    attackPlan: {
      focus: "Challenge the universal identity with exact substitution and small boundary values.",
      attacks: [
        { kind: "counterexample_search", reason: "A single exact counterexample refutes a universal family." },
        { kind: "boundary_values", reason: "Small integer parameters expose the nonzero residual." },
        { kind: "scope_audit", reason: "Confirm the result is no broader than the checked obligation." },
      ],
    },
  },
  {
    id: "true-identity",
    name: "True identity",
    description: "Exact substitution should produce a replayable proof certificate.",
    learningPrompt: "Compare a symbolic identity with checking only a finite list of t values.",
    form: {
      equation: "x^2 + y^2 = z^2",
      claim: "For every integer t, these formulas produce an integer solution.",
      proposedArgument: "x = t^2 - 1\ny = 2*t\nz = t^2 + 1",
    },
    obligation: {
      claimType: "parametric_identity",
      parameters: ["t"],
      substitutions: [
        { variable: "x", expression: "t^2 - 1" },
        { variable: "y", expression: "2*t" },
        { variable: "z", expression: "t^2 + 1" },
      ],
      assignment: [],
      assumptions: [],
      recommendedChecks: ["symbolic_identity", "assumption_audit"],
      interpretation: "The formulas claim to satisfy the Pythagorean equation identically for every integer t.",
      confidence: "high",
    },
    attackPlan: {
      focus: "Look for hidden assumptions, cancellation, or a claim that exceeds the certificate scope.",
      attacks: [
        { kind: "zero_division_audit", reason: "A proof can fail if it silently divides by a possibly zero term." },
        { kind: "boundary_values", reason: "Boundary cases should agree with the symbolic residual." },
        { kind: "scope_audit", reason: "Generating solutions is not the same as parameterizing every solution." },
      ],
    },
  },
  {
    id: "modular-impossibility",
    name: "Modular impossibility",
    description: "A complete residue check modulo 4 proves non-existence.",
    learningPrompt: "Explain why checking every residue class modulo 4 gives a global conclusion.",
    form: {
      equation: "x^2 + y^2 = 4*z + 3",
      claim: "There are no integer solutions.",
      proposedArgument: "Try reducing the equation modulo 4.",
    },
    obligation: {
      claimType: "no_integer_solutions",
      parameters: [],
      substitutions: [],
      assignment: [],
      assumptions: [],
      recommendedChecks: ["congruence_obstruction", "counterexample_search"],
      interpretation: "The claim asserts global non-existence of integer solutions and proposes a modulo-4 obstruction.",
      confidence: "high",
    },
    attackPlan: {
      focus: "Try to find an exact solution and independently replay the modulo-4 residue enumeration.",
      attacks: [
        { kind: "congruence_scan", reason: "Every residue assignment modulo 4 must be exhausted." },
        { kind: "bounded_solution_search", reason: "A single exact solution would refute non-existence." },
        { kind: "scope_audit", reason: "Confirm the modular obstruction supports a global integer conclusion." },
      ],
    },
  },
] as const;

export function getDemoCase(id: unknown): DemoCase | null {
  return PROOFLAB_DEMOS.find((item) => item.id === id) ?? null;
}
