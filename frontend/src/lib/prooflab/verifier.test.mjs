import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEvidenceLedger,
  parseEquation,
  polynomialToString,
  replayCertificate,
  runAdversarialChecks,
  verifyClaim,
} from "./verifier.mjs";
import { validateAttackPlan, validateClaimExtraction } from "./contracts.ts";

test("parses implicit multiplication and normalizes an equation", () => {
  const poly = parseEquation("(t^2 - 1)^2 + (2t)^2 = (t^2 + 1)^2");
  assert.equal(polynomialToString(poly), "0");
});

test("proves the standard one-parameter Pythagorean identity", () => {
  const result = verifyClaim({
    claimType: "parametric_identity",
    equation: "x^2 + y^2 = z^2",
    substitutions: [
      { variable: "x", expression: "t^2 - 1" },
      { variable: "y", expression: "2*t" },
      { variable: "z", expression: "t^2 + 1" },
    ],
    assumptions: [],
    status: "DISPROVED",
  });
  assert.equal(result.status, "PROVED");
  assert.equal(result.residual, "0");
  assert.equal(replayCertificate(result.certificate).valid, true);
});

test("disproves a false Pythagorean parameterization with an exact counterexample", () => {
  const result = verifyClaim({
    claimType: "parametric_identity",
    equation: "x^2 + y^2 = z^2",
    substitutions: {
      x: "t^2 + 1",
      y: "2*t",
      z: "t^2 - 1",
    },
    assumptions: [],
  });
  assert.equal(result.status, "DISPROVED");
  assert.equal(result.residual, "8*t^2");
  assert.deepEqual(result.counterexample.assignment, { t: 1 });
  assert.equal(result.counterexample.residualValue, "8");
  assert.equal(replayCertificate(result.certificate).valid, true);
});

test("bare integer-domain restatements do not hide an exact counterexample", () => {
  const obligation = {
    claimType: "parametric_identity",
    equation: "x^2 + y^2 = z^2",
    substitutions: { x: "t^2 + 1", y: "2*t", z: "t^2 - 1" },
  };
  const ambientDomain = verifyClaim({ ...obligation, assumptions: ["t is an integer"] });
  const materialCondition = verifyClaim({ ...obligation, assumptions: ["t is a positive integer"] });

  assert.equal(ambientDomain.status, "DISPROVED");
  assert.deepEqual(ambientDomain.certificate.assumptions, []);
  assert.equal(materialCondition.status, "UNKNOWN");
});

test("a model-supplied PROVED status cannot forge a proof", () => {
  const result = verifyClaim({
    claimType: "parametric_identity",
    equation: "x = 0",
    substitutions: { x: "t" },
    assumptions: [],
    status: "PROVED",
    modelStatus: "PROVED",
  });
  assert.equal(result.status, "DISPROVED");
});

test("proves non-existence using a complete congruence obstruction", () => {
  const result = verifyClaim({
    claimType: "no_integer_solutions",
    equation: "x^2 + y^2 = 4*z + 3",
    substitutions: [],
    assumptions: [],
  });
  assert.equal(result.status, "PROVED");
  assert.equal(result.obstruction.modulus, 4);
  assert.equal(replayCertificate(result.certificate).valid, true);
});

test("finds an exact solution before leaving a false non-existence claim unresolved", () => {
  const result = verifyClaim({
    claimType: "no_integer_solutions",
    equation: "x^2 + y^2 = z^2",
    substitutions: [],
    assumptions: [],
  });
  assert.equal(result.status, "DISPROVED");
  assert.ok(result.counterexample);
  assert.equal(replayCertificate(result.certificate).valid, true);
});

test("returns UNKNOWN rather than upgrading a failed search to a theorem", () => {
  const result = verifyClaim({
    claimType: "no_integer_solutions",
    equation: "x^2 + y^2 = 3",
    substitutions: [],
    assumptions: ["x and y are positive"],
  });
  // This particular equation has a mod-4 obstruction, so the assumptions do not weaken the proof.
  assert.equal(result.status, "PROVED");

  const unknown = verifyClaim({
    claimType: "no_integer_solutions",
    equation: "x^2 - 61*y^2 = -1",
    substitutions: [],
    assumptions: [],
  });
  assert.ok(["DISPROVED", "UNKNOWN"].includes(unknown.status));
  if (unknown.status === "UNKNOWN") assert.equal(unknown.certificate, null);
});

test("rejects unsupported division rather than pretending to certify a rational expression", () => {
  assert.throws(
    () => parseEquation("y = (t^2 - 1) / (t + 1)"),
    (error) => error?.code === "UNSUPPORTED_DIVISION",
  );
});

test("adversarial review detects cancellation language and preserves scope", () => {
  const obligation = {
    claimType: "parametric_identity",
    equation: "x^2 + y^2 = z^2",
    substitutions: { x: "t^2 - 1", y: "2*t", z: "t^2 + 1" },
    assumptions: [],
  };
  const verification = verifyClaim(obligation);
  const audit = runAdversarialChecks({
    obligation,
    verification,
    proposedArgument: "Divide by t and cancel the denominator.",
    proposedAttacks: [{ kind: "zero_division_audit" }],
  });
  assert.ok(audit.checks.some((check) => check.kind === "zero_division_audit" && check.outcome === "FOUND_ISSUE"));
  assert.ok(audit.checks.some((check) => check.kind === "scope_audit" && check.outcome === "PASSED"));
});

test("evidence ledger marks GPT interpretation as non-authoritative", () => {
  const obligation = {
    claimType: "verify_assignment",
    equation: "x^2 + y^2 = z^2",
    assignment: { x: 3, y: 4, z: 5 },
  };
  const verification = verifyClaim(obligation);
  const ledger = buildEvidenceLedger(obligation, verification);
  assert.equal(verification.status, "PROVED");
  assert.match(ledger[0].scope, /cannot assign proof status/i);
});

test("tampering invalidates a replayable certificate", () => {
  const result = verifyClaim({
    claimType: "verify_assignment",
    equation: "x^2 + y^2 = z^2",
    assignment: { x: 3, y: 4, z: 5 },
  });
  const tampered = structuredClone(result.certificate);
  tampered.assignment.x = 6;
  assert.equal(replayCertificate(tampered).valid, false);
});

test("certificates identify the engine, schema, canonical input, and creation time", () => {
  const result = verifyClaim({
    claimType: "verify_assignment",
    equation: "x^2 + y^2 = z^2",
    assignment: { x: 3, y: 4, z: 5 },
  });
  assert.equal(result.certificate.version, 2);
  assert.match(result.certificate.verifierVersion, /^prooflab-verifier-/);
  assert.equal(result.certificate.schemaVersion, "prooflab-obligation-1");
  assert.equal(result.certificate.canonicalInput.normalizedEquation, "x^2 + y^2 - z^2 = 0");
  assert.ok(Number.isFinite(Date.parse(result.certificate.createdAt)));
  assert.equal(replayCertificate(result.certificate).valid, true);
});


test("rejects malformed GPT claim extraction", () => {
  assert.throws(
    () => validateClaimExtraction({
      claimType: "parametric_identity",
      parameters: ["t"],
      substitutions: [{ variable: "x", expression: "" }],
      assignment: [],
      assumptions: [],
      recommendedChecks: ["symbolic_identity"],
      interpretation: "Extracted a family.",
      confidence: "high",
    }),
    (error) => error?.code === "MODEL_SCHEMA_ERROR",
  );
});

test("attack plans are restricted to deterministic tool names", () => {
  assert.throws(
    () => validateAttackPlan({
      attacks: [{ kind: "declare_proved", reason: "Trust the model." }],
      focus: "Attempt an unsupported status upgrade.",
    }),
    (error) => error?.code === "MODEL_SCHEMA_ERROR",
  );
});

test("an incomplete parameterization remains UNKNOWN", () => {
  const result = verifyClaim({
    claimType: "parametric_identity",
    equation: "x^2 + y^2 = z^2",
    parameters: ["t"],
    substitutions: { x: "t" },
    assumptions: [],
  });
  assert.equal(result.status, "UNKNOWN");
  assert.deepEqual(result.missingTargets, ["y", "z"]);
});

test("a candidate solution does not refute side-conditioned non-existence until assumptions are checked", () => {
  const result = verifyClaim({
    claimType: "no_integer_solutions",
    equation: "x^2 + y^2 = z^2",
    substitutions: [],
    assumptions: ["x, y, and z are all nonzero positive integers"],
  });
  assert.equal(result.status, "UNKNOWN");
  assert.ok(result.candidateSolution);
});

test("a concrete solution with unverified side conditions remains UNKNOWN", () => {
  const result = verifyClaim({
    claimType: "verify_assignment",
    equation: "x^2 + y^2 = z^2",
    assignment: { x: 3, y: 4, z: 5 },
    assumptions: ["x, y, and z form a primitive positive triple"],
  });
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.residualValue, "0");
  assert.equal(result.certificate, null);
});

test("dependent target substitutions are rejected instead of misapplied simultaneously", () => {
  const result = verifyClaim({
    claimType: "parametric_identity",
    equation: "x = y + 1",
    parameters: ["t"],
    substitutions: { x: "y + 1", y: "t" },
    assumptions: [],
  });
  assert.equal(result.status, "UNKNOWN");
  assert.ok(result.dependentSubstitutions.length > 0);
});
