import { evaluatePolynomial, parsePolynomial } from "../src/lib/prooflab/verifier.mjs";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const cases = JSON.parse(raw);
const values = cases.map(({ expression, assignment }) =>
  evaluatePolynomial(parsePolynomial(expression), assignment).toString(),
);
process.stdout.write(JSON.stringify(values));
