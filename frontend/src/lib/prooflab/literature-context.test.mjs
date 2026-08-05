import test from "node:test";
import assert from "node:assert/strict";

import { lookupLiteratureContext, LITERATURE_REVIEWED_AT } from "./literature-context.ts";
import { verifyClaim } from "./verifier.mjs";

function lookup({ equation = "x = x", claim, proposedArgument = "" }) {
  return lookupLiteratureContext({ equation, claim, proposedArgument });
}

test("corrects the Poincaré conjecture to established rather than open", () => {
  const context = lookup({ claim: "The Poincaré conjecture is an important open problem." });

  assert.equal(context?.problemId, "poincare-conjecture");
  assert.equal(context?.status, "established");
  assert.equal(context?.reviewedAt, LITERATURE_REVIEWED_AT);
  assert.match(context?.sources[0].url ?? "", /^https:\/\/www\.claymath\.org\//);
});

test("recognizes the cubic Fermat equation without relying on model memory", () => {
  const context = lookup({
    equation: "x^3 + y^3 = z^3",
    claim: "There are no positive nonzero integer solutions.",
  });

  assert.equal(context?.problemId, "fermats-last-theorem");
  assert.equal(context?.status, "established");
  assert.match(context?.summary ?? "", /n = 3 case/i);
});

test("recognizes superscript notation for sums of three cubes as partially resolved", () => {
  const context = lookup({ equation: "a³ + b³ + c³ = k", claim: "Classify all integer targets k." });

  assert.equal(context?.problemId, "sums-of-three-cubes");
  assert.equal(context?.status, "partially_resolved");
  assert.match(context?.summary ?? "", /modulo 9/i);
  assert.match(context?.scopeNote ?? "", /specific instance/i);
});

test("marks the six unresolved Millennium Prize Problems as open", () => {
  const names = [
    "Riemann hypothesis",
    "P versus NP",
    "Birch and Swinnerton-Dyer conjecture",
    "Hodge conjecture",
    "Navier-Stokes existence and smoothness",
    "Yang-Mills mass gap",
  ];

  for (const claim of names) {
    assert.equal(lookup({ claim })?.status, "open", claim);
  }
});

test("does not attach famous-problem context to an ordinary polynomial claim", () => {
  const context = lookup({
    equation: "x^2 + y^2 = z^2",
    claim: "These proposed formulas satisfy the equation for every integer t.",
    proposedArgument: "x=t^2+1; y=2*t; z=t^2-1",
  });

  assert.equal(context, null);
});

test("an established literature result cannot overwrite an UNKNOWN verifier verdict", () => {
  const input = {
    equation: "x^3 + y^3 = z^3",
    claim: "There are no positive nonzero integer solutions.",
    proposedArgument: "This is the n=3 case of Fermat's Last Theorem.",
  };
  const context = lookupLiteratureContext(input);
  const verification = verifyClaim({
    claimType: "no_integer_solutions",
    equation: input.equation,
    assumptions: ["x, y, and z are positive nonzero integers"],
  });

  assert.equal(context?.status, "established");
  assert.equal(verification.status, "UNKNOWN");
  assert.equal(verification.certificate, null);
  assert.match(context?.verifierBoundary ?? "", /cannot change the deterministic verdict/i);
});
