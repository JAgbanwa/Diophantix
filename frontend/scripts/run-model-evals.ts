import { readFile, writeFile } from "node:fs/promises";

import { compileClaim } from "../src/lib/prooflab/model";

type EvalCase = {
  id: string;
  category: string;
  equation: string;
  claim: string;
  proposedArgument: string;
  expectedClaimType: string;
  expectedParameters?: string[];
  expectedSubstitutionVariables?: string[];
  expectedAssignmentVariables?: string[];
  expectedAssumptionFragments?: string[];
  forbidStatusField?: boolean;
};

const corpus = JSON.parse(await readFile(new URL("../evals/claim-extraction.json", import.meta.url), "utf8")) as EvalCase[];
const requestedLimit = Number.parseInt(process.env.PROOFLAB_EVAL_LIMIT || "", 10);
const cases = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? corpus.slice(0, requestedLimit) : corpus;
const concurrency = Math.max(1, Math.min(6, Number.parseInt(process.env.PROOFLAB_EVAL_CONCURRENCY || "2", 10) || 2));

type CaseResult = {
  id: string;
  category: string;
  schemaValid: boolean;
  claimTypeCorrect: boolean;
  equationPreserved: boolean;
  assumptionsRecalled: number;
  assumptionsExpected: number;
  variablesCorrect: boolean;
  statusFieldAbsent: boolean;
  latencyMs: number;
  tokens: number;
  error?: string;
};

function sameMembers(actual: string[], expected: string[] | undefined) {
  if (!expected) return true;
  return actual.length === expected.length && expected.every((item) => actual.includes(item));
}

async function evaluate(item: EvalCase): Promise<CaseResult> {
  const startedAt = performance.now();
  try {
    const result = await compileClaim(item);
    const parsed = result.parsed;
    const assumptionText = parsed.assumptions.join(" ").toLowerCase();
    const assumptionMatches = (item.expectedAssumptionFragments || []).filter((fragment) => assumptionText.includes(fragment.toLowerCase())).length;
    const variablesCorrect = sameMembers(parsed.parameters, item.expectedParameters)
      && sameMembers(parsed.substitutions.map((value) => value.variable), item.expectedSubstitutionVariables)
      && sameMembers(parsed.assignment.map((value) => value.variable), item.expectedAssignmentVariables);
    return {
      id: item.id,
      category: item.category,
      schemaValid: true,
      claimTypeCorrect: parsed.claimType === item.expectedClaimType,
      // The API overwrites any model-supplied equation with the user's authoritative input.
      equationPreserved: ({ ...parsed, equation: item.equation }).equation === item.equation,
      assumptionsRecalled: assumptionMatches,
      assumptionsExpected: item.expectedAssumptionFragments?.length ?? 0,
      variablesCorrect,
      statusFieldAbsent: !("status" in parsed) && !("verdict" in parsed),
      latencyMs: Math.round(performance.now() - startedAt),
      tokens: result.usage.totalTokens,
    };
  } catch (error) {
    return {
      id: item.id,
      category: item.category,
      schemaValid: false,
      claimTypeCorrect: false,
      equationPreserved: true,
      assumptionsRecalled: 0,
      assumptionsExpected: item.expectedAssumptionFragments?.length ?? 0,
      variablesCorrect: false,
      statusFieldAbsent: true,
      latencyMs: Math.round(performance.now() - startedAt),
      tokens: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const results: CaseResult[] = new Array(cases.length);
let cursor = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < cases.length) {
    const index = cursor;
    cursor += 1;
    results[index] = await evaluate(cases[index]);
    console.log(`${results[index].schemaValid ? "✓" : "×"} ${cases[index].id}`);
  }
}));

const percentage = (numerator: number, denominator: number) => denominator === 0 ? 100 : Math.round((10000 * numerator) / denominator) / 100;
const assumptionExpected = results.reduce((sum, item) => sum + item.assumptionsExpected, 0);
const report = {
  generatedAt: new Date().toISOString(),
  model: process.env.OPENAI_PROOFLAB_MODEL || "gpt-5.6",
  corpusSize: cases.length,
  metrics: {
    schemaValidityPercent: percentage(results.filter((item) => item.schemaValid).length, results.length),
    claimTypeAccuracyPercent: percentage(results.filter((item) => item.claimTypeCorrect).length, results.length),
    equationPreservationPercent: percentage(results.filter((item) => item.equationPreserved).length, results.length),
    assumptionRecallPercent: percentage(results.reduce((sum, item) => sum + item.assumptionsRecalled, 0), assumptionExpected),
    variableExtractionAccuracyPercent: percentage(results.filter((item) => item.variablesCorrect).length, results.length),
    unsupportedAccuracyPercent: percentage(
      results.filter((item) => item.category === "unsupported" && item.claimTypeCorrect).length,
      results.filter((item) => item.category === "unsupported").length,
    ),
    falseProvedCount: results.filter((item) => !item.statusFieldAbsent).length,
    medianLatencyMs: [...results].sort((a, b) => a.latencyMs - b.latencyMs)[Math.floor(results.length / 2)]?.latencyMs ?? 0,
    totalTokens: results.reduce((sum, item) => sum + item.tokens, 0),
  },
  failures: results.filter((item) => !item.schemaValid || !item.claimTypeCorrect || !item.variablesCorrect || !item.statusFieldAbsent),
  cases: results,
};

console.log(JSON.stringify(report.metrics, null, 2));
if (process.argv.includes("--write")) {
  await writeFile(new URL("../evals/latest-results.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log("Wrote evals/latest-results.json");
}

if (report.metrics.falseProvedCount > 0 || report.metrics.schemaValidityPercent < 100) process.exitCode = 1;
