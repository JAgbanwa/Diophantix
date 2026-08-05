import { readFile, writeFile } from "node:fs/promises";

import { planAttacks } from "../src/lib/prooflab/model";
import { sanitizeAttackPlan } from "../src/lib/prooflab/verifier.mjs";

type AttackEvalCase = {
  id: string;
  category: string;
  payload: { obligation: { claimType: string }; [key: string]: unknown };
  expectedAllowedKinds: string[];
  expectedAtLeastOne: string[];
};

type CaseResult = {
  id: string;
  category: string;
  schemaValid: boolean;
  rawPlanRelevant: boolean;
  usefulStrategyPresent: boolean;
  postPolicySafe: boolean;
  statusFieldAbsent: boolean;
  proposedKinds: string[];
  acceptedKinds: string[];
  droppedKinds: string[];
  latencyMs: number;
  tokens: number;
  error?: string;
};

const corpus = JSON.parse(await readFile(new URL("../evals/attack-planning.json", import.meta.url), "utf8")) as AttackEvalCase[];
const requestedLimit = Number.parseInt(process.env.PROOFLAB_EVAL_LIMIT || "", 10);
const cases = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? corpus.slice(0, requestedLimit) : corpus;
const concurrency = Math.max(1, Math.min(4, Number.parseInt(process.env.PROOFLAB_EVAL_CONCURRENCY || "2", 10) || 2));

async function evaluate(item: AttackEvalCase): Promise<CaseResult> {
  const startedAt = performance.now();
  try {
    const result = await planAttacks(item.payload);
    const proposedKinds = result.parsed.attacks.map((attack) => attack.kind);
    const applicable = sanitizeAttackPlan(item.payload.obligation, result.parsed);
    const acceptedKinds: string[] = applicable.attacks.map((attack: { kind: string }) => attack.kind);
    const droppedKinds = proposedKinds.filter((kind) => !acceptedKinds.includes(kind));
    return {
      id: item.id,
      category: item.category,
      schemaValid: true,
      rawPlanRelevant: proposedKinds.every((kind) => item.expectedAllowedKinds.includes(kind)),
      usefulStrategyPresent: proposedKinds.some((kind) => item.expectedAtLeastOne.includes(kind)),
      postPolicySafe: acceptedKinds.every((kind) => item.expectedAllowedKinds.includes(kind)),
      statusFieldAbsent: !("status" in result.parsed) && !("verdict" in result.parsed),
      proposedKinds,
      acceptedKinds,
      droppedKinds,
      latencyMs: Math.round(performance.now() - startedAt),
      tokens: result.usage.totalTokens,
    };
  } catch (error) {
    return {
      id: item.id,
      category: item.category,
      schemaValid: false,
      rawPlanRelevant: false,
      usefulStrategyPresent: false,
      postPolicySafe: false,
      statusFieldAbsent: true,
      proposedKinds: [],
      acceptedKinds: [],
      droppedKinds: [],
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

const percentage = (numerator: number, denominator: number) => denominator === 0 ? 100 : Math.round((10_000 * numerator) / denominator) / 100;
const report = {
  generatedAt: new Date().toISOString(),
  model: process.env.OPENAI_PROOFLAB_MODEL || "gpt-5.6",
  corpusSize: cases.length,
  metrics: {
    schemaValidityPercent: percentage(results.filter((item) => item.schemaValid).length, results.length),
    rawPlanRelevancePercent: percentage(results.filter((item) => item.rawPlanRelevant).length, results.length),
    usefulStrategyCoveragePercent: percentage(results.filter((item) => item.usefulStrategyPresent).length, results.length),
    postPolicySafetyPercent: percentage(results.filter((item) => item.postPolicySafe).length, results.length),
    droppedAttackCount: results.reduce((sum, item) => sum + item.droppedKinds.length, 0),
    forbiddenProofStatusCount: results.filter((item) => !item.statusFieldAbsent).length,
    medianLatencyMs: [...results].sort((a, b) => a.latencyMs - b.latencyMs)[Math.floor(results.length / 2)]?.latencyMs ?? 0,
    totalTokens: results.reduce((sum, item) => sum + item.tokens, 0),
  },
  failures: results.filter((item) => !item.schemaValid || !item.rawPlanRelevant || !item.usefulStrategyPresent || !item.postPolicySafe || !item.statusFieldAbsent),
  cases: results,
};

console.log(JSON.stringify(report.metrics, null, 2));
if (process.argv.includes("--write")) {
  await writeFile(new URL("../evals/latest-attack-results.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
  console.log("Wrote evals/latest-attack-results.json");
}

if (report.metrics.schemaValidityPercent < 100 || report.metrics.postPolicySafetyPercent < 100 || report.metrics.forbiddenProofStatusCount > 0) {
  process.exitCode = 1;
}
