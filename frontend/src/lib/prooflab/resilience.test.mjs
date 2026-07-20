import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluatePolynomial,
  parseEquation,
  parsePolynomial,
  ProofLabError,
  replayCertificate,
  verifyClaim,
} from "./verifier.mjs";

function seededRandom(seed = 0x5eed1234) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const random = seededRandom();
const integer = (minimum, maximum) => Math.floor(random() * (maximum - minimum + 1)) + minimum;

test("random supported polynomials preserve integer evaluation through parsing", () => {
  for (let sample = 0; sample < 250; sample += 1) {
    const coefficients = Array.from({ length: 6 }, () => integer(-8, 8));
    const expression = `${coefficients[0]}*x^2 + ${coefficients[1]}*x*y + ${coefficients[2]}*y^2 + ${coefficients[3]}*x + ${coefficients[4]}*y + ${coefficients[5]}`;
    const assignment = { x: integer(-12, 12), y: integer(-12, 12) };
    const expected = BigInt(coefficients[0]) * BigInt(assignment.x) ** 2n
      + BigInt(coefficients[1]) * BigInt(assignment.x) * BigInt(assignment.y)
      + BigInt(coefficients[2]) * BigInt(assignment.y) ** 2n
      + BigInt(coefficients[3]) * BigInt(assignment.x)
      + BigInt(coefficients[4]) * BigInt(assignment.y)
      + BigInt(coefficients[5]);
    assert.equal(evaluatePolynomial(parsePolynomial(expression), assignment), expected);
  }
});

test("parser fuzzing rejects unsupported input without executing it", () => {
  const hostileFragments = [
    "process.exit()",
    "x / (y-y)",
    "x; globalThis.pwned = true",
    "x ** -1",
    "x[constructor]",
    "<script>alert(1)</script>",
    "x = y = z",
    "x + 🧨",
  ];
  for (const fragment of hostileFragments) {
    assert.throws(
      () => parseEquation(fragment),
      (error) => error instanceof ProofLabError,
      fragment,
    );
  }
  assert.equal(globalThis.pwned, undefined);
});

test("polynomial safety budgets reject exponent, term, and input explosions", () => {
  assert.throws(() => parsePolynomial("x^65"), (error) => error?.code === "INVALID_EXPONENT");
  assert.throws(
    () => parsePolynomial("(x + y + z + a + b + c)^8", { limits: { maxTerms: 100 } }),
    (error) => error?.code === "TERM_BUDGET_EXCEEDED",
  );
  assert.throws(
    () => parsePolynomial("x+".repeat(400) + "1"),
    (error) => error?.code === "INPUT_TOO_LONG",
  );
});

test("random exact-assignment certificates replay and fail after mutation", () => {
  for (let sample = 0; sample < 80; sample += 1) {
    const x = integer(-100, 100);
    const y = integer(-100, 100);
    const result = verifyClaim({
      claimType: "verify_assignment",
      equation: "x + y = z",
      assignment: { x, y, z: x + y },
    });
    assert.equal(result.status, "PROVED");
    assert.equal(replayCertificate(result.certificate).valid, true);
    const tampered = structuredClone(result.certificate);
    tampered.assignment.z += 1;
    assert.equal(replayCertificate(tampered).valid, false);
  }
});

test("Vercel routing checks native Next functions before the Flask catch-all", async () => {
  const configUrl = new URL("../../../../vercel.json", import.meta.url);
  const config = JSON.parse(await readFile(configUrl, "utf8"));
  const filesystemIndex = config.routes.findIndex((route) => route.handle === "filesystem");
  const flaskApiIndex = config.routes.findIndex((route) => route.src === "/api/(.*)" && route.dest === "/app.py");
  assert.ok(filesystemIndex >= 0, "vercel.json must contain a filesystem handle");
  assert.ok(flaskApiIndex > filesystemIndex, "the Flask API catch-all must run after filesystem/native Next routes");
});
