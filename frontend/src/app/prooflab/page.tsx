"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import "./prooflab.css";

type ProofStatus =
  | "PROVED"
  | "DISPROVED"
  | "VERIFIED_IN_RANGE"
  | "EXPERIMENTAL_EVIDENCE"
  | "CONJECTURAL"
  | "UNKNOWN";

type FormState = {
  equation: string;
  claim: string;
  proposedArgument: string;
};

type Substitution = { variable: string; expression: string };
type Assignment = { variable: string; value: number };

type Obligation = {
  claimType: string;
  parameters: string[];
  substitutions: Substitution[];
  assignment: Assignment[];
  assumptions: string[];
  recommendedChecks: string[];
  interpretation: string;
  confidence: "high" | "medium" | "low";
  equation: string;
};

type Verification = {
  status: ProofStatus;
  title: string;
  summary: string;
  verifierControlled: boolean;
  residual?: string;
  residualValue?: string;
  counterexample?: { assignment?: Record<string, number>; residualValue?: string } | Record<string, number> | null;
  certificate?: Record<string, unknown> | null;
  obstruction?: { modulus?: number; assignmentsChecked?: number; checkedModuli?: number[] };
  boundedSearch?: { checked?: number; complete?: boolean; bound?: number; found?: Record<string, number> | null };
  scope?: string;
  caveat?: string;
};

type EvidenceRow = {
  step: string;
  method: string;
  result: string;
  scope: string;
};

type AnalysisResponse = {
  ok: true;
  mode: "analyze";
  model: string | null;
  compiler: {
    kind: "openai" | "deterministic_demo";
    label: string;
    model: string | null;
  };
  obligation: Obligation;
  verification: Verification;
  evidenceLedger: EvidenceRow[];
  certificateReplay: { valid: boolean; reason?: string } | null;
  proofCapsule: (Record<string, unknown> & { capsuleHash: string }) | null;
  policy: {
    modelRole: string;
    verifierRole: string;
    provedInvariant: string;
  };
};

type AttackCheck = {
  kind: string;
  outcome: "PASSED" | "FOUND_ISSUE" | "INCONCLUSIVE" | "NOT_APPLICABLE";
  detail: string;
  evidence?: unknown;
};

type AttackResponse = {
  ok: true;
  mode: "attack";
  model: string;
  plan: {
    focus: string;
    attacks: { kind: string; reason: string }[];
  };
  adversarialReview: {
    checks: AttackCheck[];
    summary: string;
    issueCount: number;
    inconclusiveCount: number;
  };
};

type Health = {
  ok: boolean;
  model?: string;
  openaiConfigured?: boolean;
  deterministicDemoAvailable?: boolean;
};

type ReplayResult = {
  valid: boolean;
  reason?: string;
  status?: ProofStatus;
  verifier?: string;
  certificateHash?: string;
  capsuleHash?: string;
};

const EXAMPLES: { id: string; name: string; description: string; form: FormState }[] = [
  {
    id: "false-family",
    name: "False family",
    description: "An exact residual and counterexample should refute it.",
    form: {
      equation: "x^2 + y^2 = z^2",
      claim: "For every integer t, these formulas produce a Pythagorean triple.",
      proposedArgument: "x = t^2 + 1\ny = 2*t\nz = t^2 - 1",
    },
  },
  {
    id: "true-identity",
    name: "True identity",
    description: "Exact substitution should produce a replayable proof certificate.",
    form: {
      equation: "x^2 + y^2 = z^2",
      claim: "For every integer t, these formulas produce an integer solution.",
      proposedArgument: "x = t^2 - 1\ny = 2*t\nz = t^2 + 1",
    },
  },
  {
    id: "modular-impossibility",
    name: "Modular impossibility",
    description: "A complete residue check modulo 4 proves non-existence.",
    form: {
      equation: "x^2 + y^2 = 4*z + 3",
      claim: "There are no integer solutions.",
      proposedArgument: "Try reducing the equation modulo 4.",
    },
  },
];

const STATUS_COPY: Record<ProofStatus, { label: string; note: string }> = {
  PROVED: { label: "Proved", note: "A replayable deterministic certificate was produced." },
  DISPROVED: { label: "Disproved", note: "An exact contradiction or counterexample was produced." },
  VERIFIED_IN_RANGE: { label: "Verified in range", note: "A complete bounded computation was run; no global theorem is claimed." },
  EXPERIMENTAL_EVIDENCE: { label: "Experimental evidence", note: "The evidence is computational and incomplete." },
  CONJECTURAL: { label: "Conjectural", note: "A pattern was detected without a proof." },
  UNKNOWN: { label: "Unknown", note: "The available deterministic verifiers do not settle the claim." },
};

function readableName(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formsMatch(left: FormState, right: FormState) {
  return left.equation === right.equation
    && left.claim === right.claim
    && left.proposedArgument === right.proposedArgument;
}

function formatCounterexample(counterexample: Verification["counterexample"]) {
  if (!counterexample) return null;
  if ("assignment" in counterexample && counterexample.assignment) {
    const assignment = Object.entries(counterexample.assignment)
      .map(([name, value]) => `${name} = ${value}`)
      .join(", ");
    return `${assignment}${counterexample.residualValue ? `; residual = ${counterexample.residualValue}` : ""}`;
  }
  return Object.entries(counterexample)
    .map(([name, value]) => `${name} = ${value}`)
    .join(", ");
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const message = payload?.error || `Request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}

export default function ProofLabPage() {
  const { theme, toggle } = useTheme();
  const [form, setForm] = useState<FormState>(EXAMPLES[0].form);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [attack, setAttack] = useState<AttackResponse | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [error, setError] = useState("");
  const [artifactNotice, setArtifactNotice] = useState("");
  const [replay, setReplay] = useState<ReplayResult | null>(null);
  const [replayError, setReplayError] = useState("");
  const [isReplaying, setIsReplaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prooflab", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => { if (!cancelled) setHealth(payload); })
      .catch(() => { if (!cancelled) setHealth({ ok: false }); });
    return () => { cancelled = true; };
  }, []);

  const certificateHash = useMemo(() => {
    const certificate = analysis?.verification.certificate;
    return typeof certificate?.certificateHash === "string" ? certificate.certificateHash : null;
  }, [analysis]);

  function updateField(field: keyof FormState, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setAnalysis(null);
    setAttack(null);
    setError("");
  }

  function loadExample(example: (typeof EXAMPLES)[number]) {
    setForm(example.form);
    setAnalysis(null);
    setAttack(null);
    setError("");
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    setIsAnalyzing(true);
    setError("");
    setAttack(null);
    try {
      const demo = EXAMPLES.find((example) => formsMatch(example.form, form));
      const useDemo = health?.openaiConfigured === false;
      if (useDemo && !demo) {
        throw new Error("This server has no OpenAI key. Load a built-in example to run the deterministic demo, or configure OPENAI_API_KEY for free-form claims.");
      }
      const response = await fetch("/api/prooflab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useDemo ? { mode: "demo", demoId: demo?.id } : { mode: "analyze", ...form }),
      });
      setAnalysis(await parseApiResponse<AnalysisResponse>(response));
    } catch (requestError) {
      setAnalysis(null);
      setError(requestError instanceof Error ? requestError.message : "ProofLab could not analyze this claim.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function tryToBreakIt() {
    if (!analysis) return;
    setIsAttacking(true);
    setError("");
    try {
      const response = await fetch("/api/prooflab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: health?.openaiConfigured === false ? "deterministic_attack" : "attack",
          ...form,
          obligation: analysis.obligation,
        }),
      });
      setAttack(await parseApiResponse<AttackResponse>(response));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The adversarial review failed.");
    } finally {
      setIsAttacking(false);
    }
  }

  function downloadProofCapsule() {
    if (!analysis?.proofCapsule) return;
    const blob = new Blob([compactJson(analysis.proofCapsule)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `diophantix-${analysis.verification.status.toLowerCase()}-${analysis.proofCapsule.capsuleHash.slice(0, 10)}.proof.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setArtifactNotice("Proof capsule downloaded. Replay it here or with npm run verify:capsule.");
  }

  async function copyCertificateHash() {
    if (!certificateHash) return;
    try {
      await navigator.clipboard.writeText(`sha256:${certificateHash}`);
      setArtifactNotice("Certificate hash copied.");
    } catch {
      setArtifactNotice("Clipboard access was unavailable.");
    }
  }

  async function verifyCapsuleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setReplay(null);
    setReplayError("");
    if (file.size > 250_000) {
      setReplayError("Proof capsule exceeds the 250 KB verification limit.");
      return;
    }
    setIsReplaying(true);
    try {
      const capsule = JSON.parse(await file.text());
      const response = await fetch("/api/prooflab/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capsule }),
      });
      const payload = await response.json().catch(() => null);
      if (!payload?.replay) throw new Error(payload?.error || "The replay endpoint returned no result.");
      setReplay(payload.replay as ReplayResult);
      if (!payload.replay.valid) setReplayError(payload.replay.reason || "Certificate replay failed.");
    } catch (replayFailure) {
      setReplayError(replayFailure instanceof Error ? replayFailure.message : "The selected file is not valid JSON.");
    } finally {
      setIsReplaying(false);
    }
  }

  const statusCopy = analysis ? STATUS_COPY[analysis.verification.status] : null;

  return (
    <main className="prooflab-shell">
      <header className="prooflab-header">
        <Link href="/" className="prooflab-brand" aria-label="Diophantix home">
          <span aria-hidden="true">∮</span>
          <span>Diophantix</span>
          <span className="prooflab-brand-divider">/</span>
          <strong>ProofLab</strong>
        </Link>
        <nav className="prooflab-nav" aria-label="Primary navigation">
          <a href="#verify-capsule">Verify capsule</a>
          <Link href="/app">Solver</Link>
          <Link href="/explore">Explorer</Link>
          <a href="https://github.com/JAgbanwa/Diophantix" target="_blank" rel="noreferrer">GitHub</a>
          <button type="button" onClick={toggle} className="prooflab-theme" aria-label="Toggle colour theme">
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </nav>
      </header>

      <section className="prooflab-hero">
        <div>
          <p className="prooflab-kicker">Evidence-first mathematical AI</p>
          <h1>Never confuse a search result with a theorem again.</h1>
          <p className="prooflab-intro">
            GPT-5.6 translates an informal Diophantine claim into a structured proof obligation.
            Exact polynomial arithmetic then proves it, refutes it, or says honestly that the result remains unknown.
          </p>
        </div>
        <aside className="prooflab-health" aria-label="ProofLab service status">
          <span className={`prooflab-health-dot ${health?.openaiConfigured || health?.deterministicDemoAvailable ? "is-ready" : ""}`} />
          <div>
            <strong>{health?.openaiConfigured ? "GPT-5.6 connected" : health ? "Deterministic demo ready" : "Checking service"}</strong>
            <span>{health?.openaiConfigured ? health?.model || "gpt-5.6" : "Built-in examples"} · exact proof policy</span>
          </div>
        </aside>
      </section>

      <section className="prooflab-principles" aria-label="ProofLab trust architecture">
        <article>
          <span>01</span>
          <h2>Interpret</h2>
          <p>GPT-5.6 extracts formulas, quantifiers, assumptions, and the intended claim type.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Verify</h2>
          <p>A deterministic engine expands identities, evaluates assignments, and exhausts residue classes.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Certify</h2>
          <p>Only replayable exact certificates can receive the status <strong>PROVED</strong>.</p>
        </article>
      </section>

      <div className="prooflab-workspace">
        <section className="prooflab-input-panel">
          <div className="prooflab-section-heading">
            <div>
              <span className="prooflab-eyebrow">New investigation</span>
              <h2>State the equation and the claim</h2>
            </div>
            <span className="prooflab-model-chip">
              {health?.openaiConfigured === false ? "Authored demo → exact verifier" : "GPT-5.6 → exact verifier"}
            </span>
          </div>

          <div className="prooflab-examples" aria-label="Load an example">
            {EXAMPLES.map((example) => (
              <button key={example.name} type="button" onClick={() => loadExample(example)}>
                <strong>{example.name}</strong>
                <span>{example.description}</span>
              </button>
            ))}
          </div>

          <form onSubmit={analyze} className="prooflab-form">
            <label>
              <span>Polynomial equation</span>
              <input
                value={form.equation}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateField("equation", event.target.value)}
                placeholder="x^2 + y^2 = z^2"
                spellCheck={false}
                maxLength={600}
                required
              />
              <small>Use integer coefficients and polynomial operations: +, −, *, parentheses, and ^.</small>
            </label>

            <label>
              <span>Claim to assess</span>
              <textarea
                value={form.claim}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("claim", event.target.value)}
                placeholder="For every integer t, these formulas produce a solution."
                maxLength={2000}
                rows={3}
                required
              />
            </label>

            <label>
              <span>Proposed argument or formulas <em>optional</em></span>
              <textarea
                value={form.proposedArgument}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("proposedArgument", event.target.value)}
                placeholder={"x = t^2 - 1\ny = 2*t\nz = t^2 + 1"}
                maxLength={4000}
                rows={5}
                spellCheck={false}
              />
              <small>ProofLab currently certifies polynomial identities, concrete assignments, and congruence obstructions.</small>
            </label>

            <button type="submit" className="prooflab-primary" disabled={isAnalyzing}>
              <span>
                {isAnalyzing
                  ? "Compiling and verifying…"
                  : health?.openaiConfigured === false
                    ? "Run deterministic demo"
                    : "Analyze and verify"}
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </form>

          {error && (
            <div className="prooflab-error" role="alert">
              <strong>ProofLab could not complete the request.</strong>
              <p>{error}</p>
            </div>
          )}
        </section>

        <section className={`prooflab-result-panel ${analysis ? "has-result" : ""}`} aria-live="polite">
          {!analysis ? (
            <div className="prooflab-empty">
              <span className="prooflab-empty-mark">⊢</span>
              <h2>Your evidence ledger will appear here.</h2>
              <p>
                Start with one of the examples. The model may interpret the claim, but it cannot award itself a proof.
              </p>
              <div className="prooflab-status-key">
                {(["PROVED", "DISPROVED", "VERIFIED_IN_RANGE", "UNKNOWN"] as ProofStatus[]).map((status) => (
                  <span key={status} className={`status-dot status-${status.toLowerCase()}`}>{STATUS_COPY[status].label}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="prooflab-result">
              <div className={`prooflab-verdict verdict-${analysis.verification.status.toLowerCase()}`}>
                <div>
                  <span className="prooflab-eyebrow">Deterministic verdict</span>
                  <h2>{statusCopy?.label}</h2>
                  <p>{analysis.verification.title}</p>
                </div>
                <span className="prooflab-verdict-symbol" aria-hidden="true">
                  {analysis.verification.status === "PROVED" ? "✓" : analysis.verification.status === "DISPROVED" ? "×" : "?"}
                </span>
              </div>
              <p className="prooflab-verdict-note">{statusCopy?.note}</p>

              <div className="prooflab-result-grid">
                <article>
                  <span className="prooflab-eyebrow">{analysis.compiler.label}</span>
                  <h3>{readableName(analysis.obligation.claimType)}</h3>
                  <p>{analysis.obligation.interpretation}</p>
                  <dl>
                    <div><dt>Confidence</dt><dd>{analysis.obligation.confidence}</dd></div>
                    <div><dt>Parameters</dt><dd>{analysis.obligation.parameters.join(", ") || "None extracted"}</dd></div>
                    <div><dt>Assumptions</dt><dd>{analysis.obligation.assumptions.join("; ") || "None extracted"}</dd></div>
                  </dl>
                </article>

                <article>
                  <span className="prooflab-eyebrow">Exact result</span>
                  <h3>{analysis.verification.summary}</h3>
                  {analysis.verification.residual !== undefined && (
                    <div className="prooflab-math-line"><span>Residual</span><code>{analysis.verification.residual}</code></div>
                  )}
                  {formatCounterexample(analysis.verification.counterexample) && (
                    <div className="prooflab-math-line"><span>Counterexample</span><code>{formatCounterexample(analysis.verification.counterexample)}</code></div>
                  )}
                  {analysis.verification.obstruction?.modulus && (
                    <div className="prooflab-math-line"><span>Obstruction</span><code>mod {analysis.verification.obstruction.modulus}</code></div>
                  )}
                  {analysis.verification.scope && <p className="prooflab-scope"><strong>Scope:</strong> {analysis.verification.scope}</p>}
                  {analysis.verification.caveat && <p className="prooflab-caveat">{analysis.verification.caveat}</p>}
                </article>
              </div>

              <section className="prooflab-ledger">
                <div className="prooflab-section-heading compact">
                  <div>
                    <span className="prooflab-eyebrow">Evidence ledger</span>
                    <h3>What happened, and what each step proves</h3>
                  </div>
                </div>
                <div className="prooflab-table-wrap">
                  <table>
                    <thead><tr><th>Step</th><th>Method</th><th>Result</th><th>Scope</th></tr></thead>
                    <tbody>
                      {analysis.evidenceLedger.map((row, index) => (
                        <tr key={`${row.step}-${index}`}>
                          <td>{row.step}</td>
                          <td>{row.method}</td>
                          <td><code>{row.result}</code></td>
                          <td>{row.scope}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="prooflab-certificate">
                <div>
                  <span className="prooflab-eyebrow">Replayable certificate</span>
                  <h3>{analysis.verification.certificate ? "Certificate generated" : "No proof certificate"}</h3>
                  <p>
                    {analysis.verification.certificate
                      ? `Server replay: ${analysis.certificateReplay?.valid ? "valid" : "failed"}. The hash changes if any evidence is edited.`
                      : "An unknown or bounded result cannot be promoted to PROVED."}
                  </p>
                  {certificateHash && <code className="prooflab-hash">sha256:{certificateHash}</code>}
                  {analysis.proofCapsule && (
                    <div className="prooflab-certificate-actions">
                      <button type="button" onClick={downloadProofCapsule}>Download proof capsule</button>
                      <button type="button" onClick={copyCertificateHash}>Copy hash</button>
                    </div>
                  )}
                  {artifactNotice && <p className="prooflab-artifact-notice" role="status">{artifactNotice}</p>}
                </div>
                {analysis.verification.certificate && (
                  <details>
                    <summary>Inspect certificate JSON</summary>
                    <pre>{compactJson(analysis.verification.certificate)}</pre>
                  </details>
                )}
              </section>

              <button type="button" className="prooflab-adversarial" onClick={tryToBreakIt} disabled={isAttacking}>
                <span>
                  <strong>{isAttacking ? "Running adversarial checks…" : "Try to break this argument"}</strong>
                  <small>
                    {health?.openaiConfigured === false
                      ? "Mandatory deterministic attacks run without a model planner."
                      : "GPT-5.6 proposes attacks; deterministic tools execute them."}
                  </small>
                </span>
                <span aria-hidden="true">⚒</span>
              </button>

              {attack && (
                <section className="prooflab-attack-results">
                  <div className="prooflab-section-heading compact">
                    <div>
                      <span className="prooflab-eyebrow">Adversarial review</span>
                      <h3>{attack.adversarialReview.summary}</h3>
                      <p>{attack.plan.focus}</p>
                    </div>
                  </div>
                  <div className="prooflab-check-list">
                    {attack.adversarialReview.checks.map((check, index) => (
                      <article key={`${check.kind}-${index}`} className={`check-${check.outcome.toLowerCase().replaceAll("_", "-")}`}>
                        <div>
                          <span>{readableName(check.kind)}</span>
                          <strong>{readableName(check.outcome)}</strong>
                        </div>
                        <p>{check.detail}</p>
                        {check.evidence !== undefined && <pre>{compactJson(check.evidence)}</pre>}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="prooflab-replay" id="verify-capsule">
        <div>
          <span className="prooflab-kicker">Independent replay</span>
          <h2>Do not trust the screenshot. Replay the evidence.</h2>
          <p>
            Upload a downloaded <code>.proof.json</code> capsule. ProofLab checks the capsule hash,
            enforces the claimed status, and reruns the exact polynomial or congruence verifier.
            The same artifact works offline with <code>npm run verify:capsule -- file.proof.json</code>.
          </p>
        </div>
        <div className="prooflab-replay-console" aria-live="polite">
          <label className="prooflab-upload">
            <input type="file" accept=".json,.proof.json,application/json" onChange={verifyCapsuleFile} disabled={isReplaying} />
            <span>{isReplaying ? "Replaying exact evidence…" : "Choose a proof capsule"}</span>
            <strong>Maximum 250 KB · processed by the deterministic verifier</strong>
          </label>
          {replay?.valid && (
            <div className="prooflab-replay-result is-valid">
              <span>Valid capsule</span>
              <strong>{replay.status} · {readableName(replay.verifier || "exact verifier")}</strong>
              <code>sha256:{replay.certificateHash}</code>
            </div>
          )}
          {replayError && (
            <div className="prooflab-replay-result is-invalid" role="alert">
              <span>Invalid capsule</span>
              <strong>{replayError}</strong>
            </div>
          )}
        </div>
      </section>

      <footer className="prooflab-footer">
        <div>
          <strong>Diophantix ProofLab</strong>
          <span>GPT-5.6 interprets. Exact mathematics decides.</span>
        </div>
        <p>
          ProofLab certifies only the explicitly supported obligation. It is not a replacement for peer review or a general theorem prover.
        </p>
      </footer>
    </main>
  );
}
