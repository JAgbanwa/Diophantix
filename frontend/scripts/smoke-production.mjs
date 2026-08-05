import { PROOFLAB_DEMOS } from "../src/lib/prooflab/demo-cases.ts";
import { PROOFLAB_SERVICE_VERSION } from "../src/lib/prooflab/service-contract.ts";

const baseUrl = (process.env.PROOFLAB_PRODUCTION_URL || "https://www.diophantix.com").replace(/\/$/, "");
const smokeMode = process.env.PROOFLAB_SMOKE_MODE || "live";
const expectedStatuses = {
  "false-family": "DISPROVED",
  "true-identity": "PROVED",
  "modular-impossibility": "PROVED",
};

async function api(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(55_000),
    headers: { "Content-Type": "application/json", "X-Request-Id": `production-smoke-${Date.now()}`, ...init.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(`${path} returned ${response.status}: ${payload?.code || payload?.error || "invalid JSON"}`);
  }
  return payload;
}

const health = await api("/api/prooflab", { method: "GET", headers: {} });
if (health.serviceVersion !== PROOFLAB_SERVICE_VERSION) {
  throw new Error(
    `Unexpected service version: ${health.serviceVersion}; expected ${PROOFLAB_SERVICE_VERSION}`,
  );
}
if (smokeMode === "live" && health.serviceState !== "connected") {
  throw new Error(`Live smoke requires GPT-5.6 connected; service state is ${health.serviceState}.`);
}

for (const demo of PROOFLAB_DEMOS) {
  const request = smokeMode === "live"
    ? { mode: "analyze", ...demo.form }
    : { mode: "offline_demo", demoId: demo.id };
  const analysis = await api("/api/prooflab", { method: "POST", body: JSON.stringify(request) });
  if (analysis.verification.status !== expectedStatuses[demo.id]) {
    throw new Error(`${demo.id}: expected ${expectedStatuses[demo.id]}, received ${analysis.verification.status}`);
  }
  if (analysis.verification.certificate) {
    const replay = await api("/api/prooflab", {
      method: "POST",
      body: JSON.stringify({ mode: "replay", certificate: analysis.verification.certificate }),
    });
    if (!replay.replay.valid) throw new Error(`${demo.id}: certificate replay failed.`);
  }
  const attackRequest = smokeMode === "live"
    ? { mode: "attack", ...demo.form, obligation: analysis.obligation }
    : { mode: "offline_attack", demoId: demo.id };
  const attack = await api("/api/prooflab", { method: "POST", body: JSON.stringify(attackRequest) });
  if (!Array.isArray(attack.adversarialReview.checks) || attack.adversarialReview.checks.length === 0) {
    throw new Error(`${demo.id}: adversarial review returned no checks.`);
  }
  console.log(`${demo.id}: ${analysis.verification.status}; replay and adversarial checks passed (${analysis.executionMode}).`);
}

console.log(`Production ProofLab smoke passed at ${baseUrl} in ${smokeMode} mode.`);
