import { ProofLabError } from "./verifier.mjs";

const DEMOS = Object.freeze({
  "false-family": Object.freeze({
    id: "false-family",
    name: "False family",
    description: "An exact residual and counterexample should refute it.",
    input: Object.freeze({
      equation: "x^2 + y^2 = z^2",
      claim: "For every integer t, these formulas produce a Pythagorean triple.",
      proposedArgument: "x = t^2 + 1\ny = 2*t\nz = t^2 - 1",
    }),
    obligation: Object.freeze({
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
      interpretation: "The supplied formulas claim a polynomial identity for every integer t.",
      confidence: "high",
    }),
  }),
  "true-identity": Object.freeze({
    id: "true-identity",
    name: "True identity",
    description: "Exact substitution should produce a replayable proof certificate.",
    input: Object.freeze({
      equation: "x^2 + y^2 = z^2",
      claim: "For every integer t, these formulas produce an integer solution.",
      proposedArgument: "x = t^2 - 1\ny = 2*t\nz = t^2 + 1",
    }),
    obligation: Object.freeze({
      claimType: "parametric_identity",
      parameters: ["t"],
      substitutions: [
        { variable: "x", expression: "t^2 - 1" },
        { variable: "y", expression: "2*t" },
        { variable: "z", expression: "t^2 + 1" },
      ],
      assignment: [],
      assumptions: [],
      recommendedChecks: ["symbolic_identity", "counterexample_search"],
      interpretation: "The supplied formulas claim a polynomial identity for every integer t.",
      confidence: "high",
    }),
  }),
  "modular-impossibility": Object.freeze({
    id: "modular-impossibility",
    name: "Modular impossibility",
    description: "A complete residue check modulo 4 proves non-existence.",
    input: Object.freeze({
      equation: "x^2 + y^2 = 4*z + 3",
      claim: "There are no integer solutions.",
      proposedArgument: "Try reducing the equation modulo 4.",
    }),
    obligation: Object.freeze({
      claimType: "no_integer_solutions",
      parameters: [],
      substitutions: [],
      assignment: [],
      assumptions: [],
      recommendedChecks: ["congruence_obstruction", "counterexample_search"],
      interpretation: "The claim asserts global non-existence of integer solutions.",
      confidence: "high",
    }),
  }),
});

export const PROOFLAB_DEMOS = Object.freeze(Object.values(DEMOS));

export function getProofLabDemo(id) {
  if (typeof id !== "string" || !Object.hasOwn(DEMOS, id)) {
    throw new ProofLabError("Unknown deterministic demo case.", "UNKNOWN_DEMO");
  }
  return structuredClone(DEMOS[id]);
}
