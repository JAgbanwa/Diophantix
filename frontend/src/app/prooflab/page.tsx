"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useState } from "react";

import { useTheme } from "@/components/ThemeProvider";
import type { ClaimExtraction } from "@/lib/prooflab/contracts";
import { PROOFLAB_DEMOS, type DemoCase } from "@/lib/prooflab/demo-cases";
import "./prooflab.css";

type ProofStatus =
  | "PROVED"
  | "DISPROVED"
  | "VERIFIED_IN_RANGE"
  | "EXPERIMENTAL_EVIDENCE"
  | "CONJECTURAL"
  | "UNKNOWN";

type FormState = DemoCase["form"];
type Obligation = ClaimExtraction & { equation: string };

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

type EvidenceRow = { step: string; method: string; result: string; scope: string };
type ExecutionMode = "gpt-5.6" | "offline_replay";

type AnalysisResponse = {
  ok: true;
  mode: "analyze";
  executionMode: ExecutionMode;
  model: string | null;
  obligation: Obligation;
  verification: Verification;
  evidenceLedger: EvidenceRow[];
  certificateReplay: { valid: boolean; reason?: string } | null;
  learningGuidance: string[];
  trace: { requestId: string; modelResponseId: string | null; usage: { inputTokens: number; outputTokens: number; totalTokens: number } | null };
  policy: { modelRole: string; verifierRole: string; provedInvariant: string };
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
  executionMode: ExecutionMode;
  model: string | null;
  plan: { focus: string; attacks: { kind: string; reason: string }[] };
  adversarialReview: { checks: AttackCheck[]; summary: string; issueCount: number; inconclusiveCount: number };
};

type ServiceState = "connected" | "unconfigured" | "temporarily_unavailable" | "endpoint_unreachable" | "checking";

type Health = {
  ok: true;
  model: string;
  serviceState: Exclude<ServiceState, "endpoint_unreachable" | "checking">;
  managedRateLimit: boolean;
  offlineDemosAvailable: boolean;
  requestId: string;
};

type SyntaxState = { valid: boolean; message: string; variables: string[] } | null;

const STATUS_COPY: Record<ProofStatus, { label: string; note: string }> = {
  PROVED: { label: "Proved", note: "A replayable deterministic certificate was produced." },
  DISPROVED: { label: "Disproved", note: "An exact contradiction or counterexample was produced." },
  VERIFIED_IN_RANGE: { label: "Verified in range", note: "A complete bounded computation was run; no global theorem is claimed." },
  EXPERIMENTAL_EVIDENCE: { label: "Experimental evidence", note: "The evidence is computational and incomplete." },
  CONJECTURAL: { label: "Conjectural", note: "A pattern was detected without a proof." },
  UNKNOWN: { label: "Unknown", note: "The available deterministic verifier language does not settle the claim." },
};

const PROGRESS_STAGES = [
  "Checking polynomial syntax",
  "Interpreting the claim",
  "Running the exact verifier",
  "Replaying the certificate",
];

const LEARNER_PREDICTIONS: readonly ProofStatus[] = ["PROVED", "DISPROVED", "VERIFIED_IN_RANGE", "UNKNOWN"];

class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

function readableName(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatCounterexample(counterexample: Verification["counterexample"]) {
  if (!counterexample) return null;
  if ("assignment" in counterexample && counterexample.assignment) {
    const assignment = Object.entries(counterexample.assignment).map(([name, value]) => `${name} = ${value}`).join(", ");
    return `${assignment}${counterexample.residualValue ? `; residual = ${counterexample.residualValue}` : ""}`;
  }
  return Object.entries(counterexample).map(([name, value]) => `${name} = ${value}`).join(", ");
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new ApiRequestError(
      payload?.error || `Request failed with status ${response.status}.`,
      payload?.code || "ENDPOINT_ERROR",
      response.status,
    );
  }
  return payload as T;
}

function formFromSearch(searchParams: ReturnType<typeof useSearchParams>): { form: FormState; demoId: DemoCase["id"] | null } {
  const demoId = searchParams.get("demo");
  const demo = PROOFLAB_DEMOS.find((item) => item.id === demoId);
  const equation = searchParams.get("equation")?.slice(0, 600);
  const claim = searchParams.get("claim")?.slice(0, 2_000);
  if (equation && claim) {
    return {
      form: { equation, claim, proposedArgument: searchParams.get("argument")?.slice(0, 4_000) ?? "" },
      demoId: null,
    };
  }
  return { form: demo?.form ?? PROOFLAB_DEMOS[0].form, demoId: demo?.id ?? PROOFLAB_DEMOS[0].id };
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ProofLabExperience() {
  const { theme, toggle } = useTheme();
  const searchParams = useSearchParams();
  const initial = useMemo(() => formFromSearch(searchParams), [searchParams]);
  const [form, setForm] = useState<FormState>(initial.form);
  const [selectedDemoId, setSelectedDemoId] = useState<DemoCase["id"] | null>(initial.demoId);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [attack, setAttack] = useState<AttackResponse | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [serviceState, setServiceState] = useState<ServiceState>("checking");
  const [syntax, setSyntax] = useState<SyntaxState>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState("");
  const [replayMessage, setReplayMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [educatorMode, setEducatorMode] = useState(false);
  const [learnerPrediction, setLearnerPrediction] = useState<ProofStatus | null>(null);

  async function refreshHealth() {
    setServiceState("checking");
    try {
      const response = await fetch("/api/prooflab", { cache: "no-store" });
      const payload = await parseApiResponse<Health>(response);
      setHealth(payload);
      setServiceState(payload.serviceState);
    } catch {
      setHealth(null);
      setServiceState("endpoint_unreachable");
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prooflab", { cache: "no-store" })
      .then((response) => parseApiResponse<Health>(response))
      .then((payload) => {
        if (!cancelled) {
          setHealth(payload);
          setServiceState(payload.serviceState);
        }
      })
      .catch(() => { if (!cancelled) setServiceState("endpoint_unreachable"); });
    return () => { cancelled = true; };
  }, []);

  const certificate = analysis?.verification.certificate ?? null;
  const certificateHash = typeof certificate?.certificateHash === "string" ? certificate.certificateHash : null;
  const currentDemo = PROOFLAB_DEMOS.find((item) => item.id === selectedDemoId) ?? null;
  const statusCopy = analysis ? STATUS_COPY[analysis.verification.status] : null;
  const canUseOffline = Boolean(currentDemo && health?.offlineDemosAvailable !== false);
  const useOfflineByDefault = serviceState === "unconfigured" || serviceState === "temporarily_unavailable";
  const endpointUnavailable = serviceState === "endpoint_unreachable";
  const predictionRequired = educatorMode && !learnerPrediction;
  const analyzeDisabled = isAnalyzing || endpointUnavailable || predictionRequired || (useOfflineByDefault && !canUseOffline);
  const predictionMatched = Boolean(analysis && learnerPrediction === analysis.verification.status);

  const healthCopy = {
    checking: { label: "Checking ProofLab service", detail: "Confirming the model and verifier route" },
    connected: { label: "GPT-5.6 connected", detail: `${health?.model || "gpt-5.6"} · exact verifier ready` },
    unconfigured: { label: "API key not configured", detail: "Reviewed offline demonstrations remain available" },
    temporarily_unavailable: { label: "Model temporarily unavailable", detail: "Retry or use a labeled offline replay" },
    endpoint_unreachable: { label: "ProofLab endpoint unreachable", detail: "Analysis is paused until the service responds" },
  }[serviceState];

  function resetOutput() {
    setAnalysis(null);
    setAttack(null);
    setError("");
    setReplayMessage("");
    setShareMessage("");
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setSelectedDemoId(null);
    setSyntax(null);
    setLearnerPrediction(null);
    resetOutput();
  }

  function loadExample(example: DemoCase) {
    setForm(example.form);
    setSelectedDemoId(example.id);
    setSyntax(null);
    setLearnerPrediction(null);
    resetOutput();
  }

  function toggleEducatorMode() {
    setEducatorMode((value) => !value);
    setLearnerPrediction(null);
    resetOutput();
  }

  async function validateEquation() {
    if (!form.equation.trim() || endpointUnavailable) return false;
    try {
      const response = await fetch("/api/prooflab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "validate", equation: form.equation }),
      });
      const payload = await parseApiResponse<{ normalizedEquation: string; variables: string[] }>(response);
      setSyntax({ valid: true, message: `Normalized as ${payload.normalizedEquation}`, variables: payload.variables });
      return true;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "The equation could not be parsed.";
      setSyntax({ valid: false, message, variables: [] });
      return false;
    }
  }

  function beginProgress() {
    setProgressStep(0);
    return [
      window.setTimeout(() => setProgressStep(1), 450),
      window.setTimeout(() => setProgressStep(2), 1_250),
      window.setTimeout(() => setProgressStep(3), 2_100),
    ];
  }

  async function submitAnalysis(event?: FormEvent, forceOffline = false) {
    event?.preventDefault();
    setIsAnalyzing(true);
    setError("");
    setAttack(null);
    setReplayMessage("");
    const timers = beginProgress();
    try {
      if (!(await validateEquation())) throw new Error("Correct the polynomial syntax before continuing.");
      const offline = forceOffline || useOfflineByDefault;
      if (offline && !currentDemo) {
        throw new Error("Offline replay is restricted to the three reviewed demonstrations. Load one of them first.");
      }
      const body = offline
        ? { mode: "offline_demo", demoId: currentDemo?.id }
        : { mode: "analyze", ...form };
      const response = await fetch("/api/prooflab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setAnalysis(await parseApiResponse<AnalysisResponse>(response));
      if (!offline) setServiceState("connected");
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code.startsWith("MODEL_")) {
        setServiceState("temporarily_unavailable");
      }
      setAnalysis(null);
      setError(requestError instanceof Error ? requestError.message : "ProofLab could not analyze this claim.");
    } finally {
      timers.forEach(window.clearTimeout);
      setIsAnalyzing(false);
    }
  }

  async function tryToBreakIt() {
    if (!analysis) return;
    setIsAttacking(true);
    setError("");
    try {
      const offline = analysis.executionMode === "offline_replay";
      const body = offline
        ? { mode: "offline_attack", demoId: currentDemo?.id }
        : { mode: "attack", ...form, obligation: analysis.obligation };
      const response = await fetch("/api/prooflab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setAttack(await parseApiResponse<AttackResponse>(response));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The adversarial review failed.");
    } finally {
      setIsAttacking(false);
    }
  }

  async function replayCurrentCertificate() {
    if (!certificate) return;
    setReplayMessage("Replaying with the deterministic verifier…");
    try {
      const response = await fetch("/api/prooflab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "replay", certificate }),
      });
      const payload = await parseApiResponse<{ replay: { valid: boolean; reason?: string } }>(response);
      setReplayMessage(payload.replay.valid ? "Replay passed: the evidence reproduces the certificate." : `Replay failed: ${payload.replay.reason}`);
    } catch (requestError) {
      setReplayMessage(requestError instanceof Error ? requestError.message : "Certificate replay failed.");
    }
  }

  async function shareInvestigation() {
    const url = new URL(window.location.href);
    url.search = "";
    if (currentDemo) {
      url.searchParams.set("demo", currentDemo.id);
    } else {
      url.searchParams.set("equation", form.equation);
      url.searchParams.set("claim", form.claim);
      if (form.proposedArgument) url.searchParams.set("argument", form.proposedArgument);
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareMessage("Investigation link copied.");
    } catch {
      setShareMessage(url.toString());
    }
  }

  function downloadWorksheet() {
    const result = analysis
      ? `\n## Result\n\n- Status: ${analysis.verification.status}\n- Summary: ${analysis.verification.summary}\n- Scope: ${analysis.verification.scope ?? "See the evidence ledger"}\n`
      : "\n## Student response\n\nClassify this as proved, disproved, verified only in range, or unresolved. Explain what evidence would justify your answer.\n";
    const worksheet = `# ProofLab investigation\n\n## Equation\n\n${form.equation}\n\n## Claim\n\n${form.claim}\n\n## Proposed argument\n\n${form.proposedArgument || "None supplied"}\n${result}\nGenerated by Diophantix ProofLab. A computation is not automatically a proof.\n`;
    downloadText("prooflab-investigation.md", worksheet, "text/markdown");
  }

  return (
    <main className="prooflab-shell">
      <header className="prooflab-header">
        <Link href="/prooflab" className="prooflab-brand" aria-label="Diophantix ProofLab home">
          <span aria-hidden="true">∮</span><span>Diophantix</span><span className="prooflab-brand-divider">/</span><strong>ProofLab</strong>
        </Link>
        <nav className="prooflab-nav" aria-label="ProofLab navigation">
          <a href="#workflow">Workflow</a>
          <a href="#classroom">Classroom</a>
          <a href="https://github.com/JAgbanwa/Diophantix" target="_blank" rel="noreferrer">Source</a>
          <button type="button" onClick={toggle} className="prooflab-theme" aria-label="Toggle colour theme">{theme === "dark" ? "Light" : "Dark"}</button>
        </nav>
      </header>

      <section className="prooflab-hero">
        <div>
          <p className="prooflab-kicker">A deterministic proof firewall for mathematical AI</p>
          <h1>Never confuse a search result with a theorem again.</h1>
          <p className="prooflab-intro">GPT-5.6 extracts a small proof obligation. Exact code then proves it, refutes it, or refuses to overclaim. Built for number-theory students, educators, and researchers who need to see the evidence boundary.</p>
        </div>
        <aside className={`prooflab-health state-${serviceState}`} aria-label="ProofLab service status" aria-live="polite">
          <span className="prooflab-health-dot" />
          <div><strong>{healthCopy.label}</strong><span>{healthCopy.detail}</span>{serviceState === "endpoint_unreachable" && <button type="button" onClick={refreshHealth}>Retry connection</button>}</div>
        </aside>
      </section>

      <section id="workflow" className="prooflab-principles" aria-label="ProofLab trust architecture">
        <article><span>01</span><h2>Interpret</h2><p>GPT-5.6 extracts formulas, quantifiers, and assumptions. It has no proof-status field.</p></article>
        <article><span>02</span><h2>Verify</h2><p>A deterministic engine expands identities, evaluates assignments, and exhausts residue classes.</p></article>
        <article><span>03</span><h2>Replay</h2><p>Only independently replayable exact evidence can receive <strong>PROVED</strong>.</p></article>
      </section>

      <section id="classroom" className="prooflab-educator">
        <div><span className="prooflab-eyebrow">Proof literacy</span><h2>Turn every verdict into a learning exercise.</h2><p>Ask learners to classify the evidence before revealing the deterministic result.</p></div>
        <button type="button" onClick={toggleEducatorMode} aria-pressed={educatorMode}>{educatorMode ? "Exit educator mode" : "Enter educator mode"}</button>
        {educatorMode && <div className="prooflab-exercise-strip">{PROOFLAB_DEMOS.map((demo) => <button type="button" key={demo.id} onClick={() => loadExample(demo)}><strong>{demo.name}</strong><span>{demo.learningPrompt}</span></button>)}</div>}
      </section>

      <div className="prooflab-workspace">
        <section className="prooflab-input-panel">
          <div className="prooflab-section-heading"><div><span className="prooflab-eyebrow">New investigation</span><h2>State the equation and the claim</h2></div><span className="prooflab-model-chip">GPT-5.6 → exact verifier</span></div>

          <div className="prooflab-examples" aria-label="Load a reviewed example">
            {PROOFLAB_DEMOS.map((example) => (
              <button key={example.id} type="button" className={selectedDemoId === example.id ? "is-selected" : ""} onClick={() => loadExample(example)} aria-pressed={selectedDemoId === example.id}>
                <strong>{example.name}</strong><span>{example.description}</span>
              </button>
            ))}
          </div>

          {educatorMode && <aside className="prooflab-learning-prompt"><strong>Commit to a verdict before revealing the evidence</strong><p>{currentDemo?.learningPrompt ?? "Classify the claim, then compare your reasoning with the exact evidence boundary."}</p><div className="prooflab-prediction-choices" role="group" aria-label="Predicted verdict">{LEARNER_PREDICTIONS.map((status) => <button type="button" key={status} className={learnerPrediction === status ? "is-selected" : ""} onClick={() => setLearnerPrediction(status)} aria-pressed={learnerPrediction === status} disabled={isAnalyzing || Boolean(analysis)}>{STATUS_COPY[status].label}</button>)}</div>{learnerPrediction && <small>{analysis ? "Your recorded prediction" : "Selected prediction"}: <strong>{STATUS_COPY[learnerPrediction].label}</strong>.</small>}</aside>}

          <form onSubmit={(event) => submitAnalysis(event)} className="prooflab-form" aria-busy={isAnalyzing}>
            <label>
              <span>Polynomial equation</span>
              <input value={form.equation} onChange={(event: ChangeEvent<HTMLInputElement>) => updateField("equation", event.target.value)} onBlur={validateEquation} placeholder="x^2 + y^2 = z^2" spellCheck={false} maxLength={600} required aria-invalid={syntax?.valid === false} aria-describedby="equation-help equation-status" />
              <small id="equation-help">Use integer coefficients and +, −, *, parentheses, and ^. Division is deliberately unsupported.</small>
              {syntax && <span id="equation-status" className={`prooflab-syntax ${syntax.valid ? "is-valid" : "is-invalid"}`}>{syntax.message}</span>}
              {syntax?.valid && syntax.variables.length > 0 && <span className="prooflab-variable-chips" aria-label="Detected variables">{syntax.variables.map((variable) => <code key={variable}>{variable}</code>)}</span>}
            </label>

            <label><span>Claim to assess</span><textarea value={form.claim} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("claim", event.target.value)} placeholder="For every integer t, these formulas produce a solution." maxLength={2000} rows={3} required /></label>
            <label><span>Proposed argument or formulas <em>optional</em></span><textarea value={form.proposedArgument} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField("proposedArgument", event.target.value)} placeholder={"x = t^2 - 1\ny = 2*t\nz = t^2 + 1"} maxLength={4000} rows={5} spellCheck={false} /><small>Supported today: polynomial identities, concrete assignments, and modular non-existence obstructions.</small></label>

            <button type="submit" className="prooflab-primary" disabled={analyzeDisabled}>
              <span>{endpointUnavailable ? "ProofLab service unavailable" : isAnalyzing ? PROGRESS_STAGES[progressStep] : predictionRequired ? "Choose your prediction first" : useOfflineByDefault ? canUseOffline ? "Run labeled offline replay" : "Load a reviewed example" : "Analyze with GPT-5.6"}</span><span aria-hidden="true">→</span>
            </button>
          </form>

          {isAnalyzing && <ol className="prooflab-progress" aria-live="polite">{PROGRESS_STAGES.map((stage, index) => <li key={stage} className={index < progressStep ? "is-complete" : index === progressStep ? "is-active" : ""}>{stage}</li>)}</ol>}

          {error && <div className="prooflab-error" role="alert"><strong>ProofLab could not complete the request.</strong><p>{error}</p><div>{!endpointUnavailable && <button type="button" onClick={() => submitAnalysis()}>Retry without losing this work</button>}{canUseOffline && serviceState === "temporarily_unavailable" && <button type="button" onClick={() => submitAnalysis(undefined, true)}>Use labeled offline replay</button>}</div></div>}
        </section>

        <section className={`prooflab-result-panel ${analysis ? "has-result" : ""}`} aria-live="polite">
          {!analysis ? (
            <div className="prooflab-empty"><span className="prooflab-empty-mark">⊢</span><h2>Your evidence ledger will appear here.</h2><p>Start with one of the examples. A model may interpret the claim, but it cannot award itself a proof.</p><div className="prooflab-status-key">{(["PROVED", "DISPROVED", "VERIFIED_IN_RANGE", "UNKNOWN"] as ProofStatus[]).map((status) => <span key={status} className={`status-dot status-${status.toLowerCase()}`}>{STATUS_COPY[status].label}</span>)}</div></div>
          ) : (
            <div className="prooflab-result">
              <div className={`prooflab-mode-banner mode-${analysis.executionMode}`}><strong>{analysis.executionMode === "gpt-5.6" ? "Live GPT-5.6 interpretation" : "Labeled offline replay"}</strong><span>{analysis.executionMode === "gpt-5.6" ? "The model extracted this obligation during this request." : "A reviewed obligation was loaded without a model request; the verifier still ran live."}</span></div>

              <div className={`prooflab-verdict verdict-${analysis.verification.status.toLowerCase()}`}><div><span className="prooflab-eyebrow">Deterministic verdict</span><h2>{statusCopy?.label}</h2><p>{analysis.verification.title}</p></div><span className="prooflab-verdict-symbol" aria-hidden="true">{analysis.verification.status === "PROVED" ? "✓" : analysis.verification.status === "DISPROVED" ? "×" : "?"}</span></div>
              <p className="prooflab-verdict-note">{statusCopy?.note}</p>

              {educatorMode && learnerPrediction && <section className={`prooflab-prediction-result ${predictionMatched ? "is-match" : "is-surprise"}`} aria-label="Prediction reflection"><div><span className="prooflab-eyebrow">Prediction reflection</span><h3>{predictionMatched ? "Your classification matched the exact verdict." : "The exact evidence changed the classification."}</h3></div><dl><div><dt>Your prediction</dt><dd>{STATUS_COPY[learnerPrediction].label}</dd></div><div><dt>Exact verdict</dt><dd>{statusCopy?.label}</dd></div></dl><p>{predictionMatched ? "Now identify the evidence that justifies that status—not merely the answer itself." : `Compare your reason with the evidence ledger. ${statusCopy?.note}`}</p></section>}

              <div className="prooflab-boundary" aria-label="Evidence boundary"><div><span>Interpretation</span><strong>{analysis.executionMode === "gpt-5.6" ? "GPT-5.6 extracted this" : "Reviewed demo obligation"}</strong></div><span aria-hidden="true">→</span><div><span>Verdict</span><strong>Deterministic code decided this</strong></div></div>

              <div className="prooflab-result-grid">
                <article><span className="prooflab-eyebrow">Interpretation</span><h3>{readableName(analysis.obligation.claimType)}</h3><p>{analysis.obligation.interpretation}</p><dl><div><dt>Confidence</dt><dd>{analysis.obligation.confidence}</dd></div><div><dt>Parameters</dt><dd>{analysis.obligation.parameters.join(", ") || "None extracted"}</dd></div><div><dt>Assumptions</dt><dd>{analysis.obligation.assumptions.join("; ") || "None extracted"}</dd></div></dl></article>
                <article><span className="prooflab-eyebrow">Exact result</span><h3>{analysis.verification.summary}</h3>{analysis.verification.residual !== undefined && <div className="prooflab-math-line"><span>Residual</span><code>{analysis.verification.residual}</code></div>}{formatCounterexample(analysis.verification.counterexample) && <div className="prooflab-math-line"><span>Counterexample</span><code>{formatCounterexample(analysis.verification.counterexample)}</code></div>}{analysis.verification.obstruction?.modulus && <div className="prooflab-math-line"><span>Obstruction</span><code>mod {analysis.verification.obstruction.modulus}</code></div>}{analysis.verification.scope && <p className="prooflab-scope"><strong>Scope:</strong> {analysis.verification.scope}</p>}{analysis.verification.caveat && <p className="prooflab-caveat">{analysis.verification.caveat}</p>}</article>
              </div>

              {analysis.verification.status === "UNKNOWN" && <section className="prooflab-unknown"><span className="prooflab-eyebrow">Unknown is an honest result</span><h3>What is missing, and how to reformulate</h3><ul>{analysis.learningGuidance.map((item) => <li key={item}>{item}</li>)}</ul></section>}

              <section className="prooflab-ledger"><div className="prooflab-section-heading compact"><div><span className="prooflab-eyebrow">Evidence ledger</span><h3>What happened, and what each step establishes</h3></div></div><div className="prooflab-table-wrap" tabIndex={0} role="region" aria-label="Scrollable evidence ledger"><table><caption className="prooflab-sr-only">ProofLab evidence steps and scope</caption><thead><tr><th>Step</th><th>Method</th><th>Result</th><th>Scope</th></tr></thead><tbody>{analysis.evidenceLedger.map((row, index) => <tr key={`${row.step}-${index}`}><td>{row.step}</td><td>{row.method}</td><td><code>{row.result}</code></td><td>{row.scope}</td></tr>)}</tbody></table></div></section>

              <section className="prooflab-certificate"><div><span className="prooflab-eyebrow">Replayable certificate</span><h3>{certificate ? "Certificate generated" : "No proof certificate"}</h3><p>{certificate ? `Server replay: ${analysis.certificateReplay?.valid ? "valid" : "failed"}. SHA-256 is an integrity checksum: it detects edits but is not a signature or proof of authorship.` : "An unknown or bounded result cannot be promoted to PROVED."}</p>{certificateHash && <code className="prooflab-hash">sha256:{certificateHash}</code>}<div className="prooflab-certificate-actions">{certificate && <><button type="button" onClick={replayCurrentCertificate}>Replay certificate</button><button type="button" onClick={() => downloadText("prooflab-certificate.json", compactJson(certificate), "application/json")}>Download JSON</button></>}<button type="button" onClick={shareInvestigation}>Share investigation</button><button type="button" onClick={downloadWorksheet}>Export worksheet</button></div>{replayMessage && <p className="prooflab-action-message" role="status">{replayMessage}</p>}{shareMessage && <p className="prooflab-action-message" role="status">{shareMessage}</p>}</div>{certificate && <details><summary>Inspect certificate JSON</summary><pre>{compactJson(certificate)}</pre></details>}</section>

              <button type="button" className="prooflab-adversarial" onClick={tryToBreakIt} disabled={isAttacking}><span><strong>{isAttacking ? "Running adversarial checks…" : "Try to break this argument"}</strong><small>{analysis.executionMode === "gpt-5.6" ? "GPT-5.6 proposes; deterministic policy filters and executes applicable checks." : "A reviewed plan is filtered and executed by deterministic policy."}</small></span><span aria-hidden="true">⚒</span></button>

              {attack && <section className="prooflab-attack-results"><div className="prooflab-section-heading compact"><div><span className="prooflab-eyebrow">Adversarial review · {attack.executionMode === "gpt-5.6" ? "live model plan" : "offline plan"}</span><h3>{attack.adversarialReview.summary}</h3><p>{attack.plan.focus}</p></div></div><div className="prooflab-accepted-plan"><div><strong>{attack.executionMode === "gpt-5.6" ? "Accepted GPT-5.6 plan" : "Accepted reviewed plan"}</strong><span>Only checks applicable to this claim type cross the deterministic boundary.</span></div><ol>{attack.plan.attacks.map((item) => <li key={`${item.kind}-${item.reason}`}><code>{readableName(item.kind)}</code><span>{item.reason}</span></li>)}</ol></div><div className="prooflab-check-list">{attack.adversarialReview.checks.map((check, index) => <article key={`${check.kind}-${index}`} className={`check-${check.outcome.toLowerCase().replaceAll("_", "-")}`}><div><span>{readableName(check.kind)}</span><strong>{readableName(check.outcome)}</strong></div><p>{check.detail}</p>{check.evidence !== undefined && <pre>{compactJson(check.evidence)}</pre>}</article>)}</div></section>}
            </div>
          )}
        </section>
      </div>

      <footer className="prooflab-footer"><div><strong>Diophantix ProofLab</strong><span>GPT-5.6 interprets. Exact mathematics decides.</span></div><p>ProofLab certifies only explicitly supported obligations. It is a proof-literacy tool, not a replacement for peer review or a general theorem prover.</p></footer>
    </main>
  );
}

export default function ProofLabPage() {
  return <Suspense fallback={<main className="prooflab-shell prooflab-loading">Loading ProofLab…</main>}><ProofLabExperience /></Suspense>;
}
