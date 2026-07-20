# Diophantix ProofLab

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ProofLab verification](https://github.com/JAgbanwa/Diophantix/actions/workflows/prooflab.yml/badge.svg)](https://github.com/JAgbanwa/Diophantix/actions/workflows/prooflab.yml)

**A deterministic proof firewall for mathematical AI.** GPT-5.6 extracts a small, typed mathematical obligation; exact code alone proves it, refutes it, or returns `UNKNOWN` rather than dressing evidence up as a theorem.

- **Try ProofLab:** <https://www.diophantix.com/prooflab>
- Build Week category: **Education**
- Audience: number-theory students, mathematics educators, and researchers
- Source: <https://github.com/JAgbanwa/Diophantix>

## Three judge-ready examples

| Load this example | Exact outcome | What it teaches |
|---|---|---|
| **False family** | `DISPROVED`, with residual `8*t^2` and an exact counterexample | One counterexample refutes a universal claim. |
| **True identity** | `PROVED`, with a replayable identity certificate | A symbolic zero residual is stronger than checking many values. |
| **Modular impossibility** | `PROVED`, via complete residue enumeration modulo 4 | A local obstruction can prove global integer non-existence. |

The intended journey is deliberately linear:

```text
load example → interpret → verify → replay certificate → try to break it
```

If GPT-5.6 is unavailable, those three reviewed examples still run through the live deterministic verifier as a clearly labeled **offline replay**. The fallback never pretends that a model call occurred.

## Why ProofLab exists

Students increasingly see three very different things presented with the same confident tone:

1. a finite computation;
2. plausible AI-generated proof prose;
3. a globally valid mathematical proof.

ProofLab makes the evidence boundary visible. GPT-5.6 may interpret prose and propose attacks, but its schemas contain no proof-status field. Only deterministic, replayable verification can return `PROVED`.

> **Invariant:** model output cannot assign `PROVED`, even if the user prompt explicitly asks it to forge that status.

## Trust architecture

```text
Browser
  │
  ├── GPT-5.6 path
  │     natural-language claim
  │       → Zod-derived Structured Output
  │       → runtime contract validation
  │
  ├── reviewed fallback path
  │     one of three precompiled demo obligations
  │
  └── shared deterministic boundary
        authoritative user equation
          → safe polynomial parser
          → exact BigInt verifier
          → status policy
          → versioned certificate
          → independent replay
```

The user's equation is authoritative. A model cannot silently replace it. JSON Schema and TypeScript types come from the same Zod contracts, preventing the two representations from drifting.

### Supported obligations

| Obligation | Deterministic method | Global result available |
|---|---|---|
| Polynomial parameterization | Exact substitution and expansion over `ℤ` | `PROVED` or `DISPROVED` |
| Concrete integer assignment | Exact integer evaluation | `PROVED` or `DISPROVED` |
| Claimed non-existence | Complete residue enumeration modulo selected moduli | `PROVED` when an obstruction exists |
| Inconclusive modular/small search | Explicitly bounded evidence only | `UNKNOWN` |

### Status semantics

| Status | Meaning |
|---|---|
| `PROVED` | A supported global claim has a successfully replayed deterministic certificate. |
| `DISPROVED` | An exact contradiction or counterexample has a replayable certificate. |
| `VERIFIED_IN_RANGE` | A complete finite range was checked; no global theorem is claimed. |
| `EXPERIMENTAL_EVIDENCE` | Incomplete computational evidence was collected. |
| `CONJECTURAL` | A pattern was identified without proof. |
| `UNKNOWN` | The available verifier language does not settle the claim. This is a successful, honest outcome. |

## Certificate contract

Version 2 certificates include:

- certificate, obligation-schema, and verifier-engine versions;
- the original equation and canonical normalized input;
- exact substitutions, assignments, residuals, or modular evidence;
- certificate scope and creation timestamp;
- a SHA-256 integrity checksum.

The SHA-256 value detects edits. It is **not** a digital signature, proof of authorship, or a substitute for replay. Judges can download a certificate and independently run:

```bash
cd frontend
npm run replay-certificate -- path/to/prooflab-certificate.json
```

## Local development

### 1. Clone and install

```bash
git clone https://github.com/JAgbanwa/Diophantix.git
cd Diophantix/frontend
npm ci
cp .env.example .env.local
```

Set at minimum:

```dotenv
OPENAI_API_KEY=your_server_side_api_key
OPENAI_PROOFLAB_MODEL=gpt-5.6
```

Never expose the key with a `NEXT_PUBLIC_` prefix.

### 2. Optional legacy Flask backend

The focused ProofLab flow is a native Next.js page and route handler. The pre-existing solver still uses Flask:

```bash
cd ..
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then configure `FLASK_INTERNAL_URL=http://127.0.0.1:5001` in `frontend/.env.local`.

### 3. Run

```bash
cd frontend
npm run dev
```

Open <http://localhost:3000/prooflab>.

## Production configuration

The production Vercel project needs these encrypted environment variables:

```dotenv
OPENAI_API_KEY=...
OPENAI_PROOFLAB_MODEL=gpt-5.6
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
PROOFLAB_RATE_LIMIT_SALT=...
PROOFLAB_REQUEST_LIMIT=12
PROOFLAB_DAILY_REQUEST_LIMIT=750
```

The root Vercel configuration checks filesystem/native Next functions before the legacy Flask `/api/*` catch-all. A regression test locks this ordering so `/api/prooflab` cannot silently become a Flask 404 again.

The health endpoint distinguishes:

- `connected` — GPT-5.6 is configured and no recent model failure is recorded;
- `unconfigured` — the endpoint works but `OPENAI_API_KEY` is missing;
- `temporarily_unavailable` — a recent model request failed transiently;
- endpoint unreachable — detected by the browser when the route itself cannot be reached.

In production, the Upstash REST limiter enforces per-address windows and a project-wide daily request budget across serverless instances. Without Upstash, a process-local limiter is used for development and the health response reports that managed limiting is absent. Set OpenAI project spend/rate limits and alerts in the OpenAI dashboard as an additional operational control.

## Verification

Run the complete local gate:

```bash
cd frontend
npm run verify:prooflab
```

It includes:

- 23 deterministic and randomized verifier/contract tests;
- 250 randomized parser/evaluation cases;
- 80 randomized certificate replay/tamper cases;
- 120 differential polynomial checks against SymPy;
- prompt-injection, parser-budget, unsupported-division, and route-precedence regressions;
- scoped ESLint and a deterministic `next build --webpack` production build.

GitHub Actions also installs Chromium and exercises the judge journey with Playwright. A second workflow runs against every successful deployment and daily, calling the actual deployed health endpoint, all three golden paths, certificate replay, and adversarial mode.

### Model extraction evaluations

Deterministic tests are intentionally separate from GPT extraction evals. `frontend/evals/claim-extraction.json` contains **60 task-specific claims** across:

- valid and false identities;
- concrete assignments;
- non-existence claims;
- ambiguous/unsupported mathematics;
- side conditions;
- prompt injection and attempted status forgery.

Run the full GPT-5.6 evaluation and write an evidence file only after a real run:

```bash
cd frontend
OPENAI_API_KEY=... npm run eval:prooflab -- --write
```

Reported metrics are schema validity, claim-type accuracy, authoritative-equation preservation, assumption recall, variable extraction accuracy, unsupported-case accuracy, latency, token use, and `falseProvedCount`. No metric is fabricated: if `evals/latest-results.json` is absent, the full baseline has not yet been run and no score is claimed. This follows OpenAI's guidance on [task-specific evals](https://developers.openai.com/api/docs/guides/evaluation-best-practices) and [preventing schema/type divergence](https://developers.openai.com/api/docs/guides/structured-outputs#avoid-json-schema-divergence).

## Reliability and security

- OpenAI calls and keys stay server-side.
- Requests have byte and field-length limits.
- Model calls use bounded output, a timeout, and transient retry handling.
- Production supports a managed per-address limiter and daily AI budget.
- Every request receives an `X-ProofLab-Request-Id` and structured server log event.
- Mathematical expressions use a small allow-list grammar; arbitrary JavaScript is never evaluated.
- Exponents, polynomial terms, variables, modular assignments, and bounded searches have hard budgets.
- Division is rejected instead of hiding denominator side conditions.
- Content Security Policy, frame, MIME, referrer, and permissions headers protect `/prooflab`.
- A failed search is never described as proof.
- Dependency CI fails on high/critical advisories. The remaining low/moderate development-tool advisories and mitigations are recorded in [`docs/DEPENDENCY_SECURITY.md`](docs/DEPENDENCY_SECURITY.md).

## Educator mode and impact evidence

Educator mode turns each golden case into a guided prompt: learners classify the evidence before revealing the verifier's decision. Investigations can be shared by URL or exported as a Markdown classroom worksheet.

The intended learning outcome is specific: learners should improve at distinguishing a counterexample, bounded search evidence, a symbolic identity, a modular proof, and an unresolved claim. A small user study protocol for 3–5 students or educators is ready in [`docs/USER_TESTING_PROTOCOL.md`](docs/USER_TESTING_PROTOCOL.md). Results and quotes must be recorded only after real sessions; this repository contains no invented traction.

## Current limitations

ProofLab is not a universal theorem prover. The current certificate language does not cover:

- rational functions or denominator side conditions;
- inequalities, positivity, coprimality, or divisibility as formal constraints;
- induction, infinite descent, algebraic number fields, or elliptic-curve descent;
- completeness of a parameterization;
- formulas that depend on other target variables;
- arbitrary natural-language proofs;
- Lean, Coq, or Isabelle kernel certificates.

Unsupported claims receive `UNKNOWN` plus concrete reformulation guidance. A Lean/Coq export remains a stretch goal only after deployment, evals, and user testing are solid.

## Existing Diophantix capabilities

The repository also contains the pre-existing Diophantix solver and exploration environment: integer/rational point search, polynomial and elliptic-curve modes, SSE streaming, plotting, arithmetic invariants, congruence experiments, export, history, themes, and multilingual UI. Those features are useful context, but they are not presented as Build Week work and are intentionally de-emphasized in the focused ProofLab navigation.

## OpenAI Build Week evidence

The pre-challenge baseline is immutable commit:

```text
81e3a229af489f2a81f97deeb1e32d2a3019681f
```

ProofLab, its GPT-5.6 workflow, exact verifier, certificates, adversarial mode, evals, classroom experience, deployment repair, and reliability work were added after that baseline. [`BUILD_WEEK.md`](BUILD_WEEK.md) lists the before/after boundary and submission evidence.

### How Codex contributed

Codex accelerated implementation and verification by tracing the deployed 404 to Vercel route precedence, refactoring the structured-output contract to Zod, expanding deterministic/fuzz/differential and browser tests, implementing certificate replay tooling, and tightening the focused judge flow. The human owner selected the project, defined the proof-status philosophy and contest strategy, reviewed product direction, and remains responsible for deployment credentials, final evaluation runs, user-study evidence, and submission claims.

Use `/feedback` in the Build Week Codex task and place the resulting session ID in the Devpost submission. Do not invent or copy a session ID into this repository.

## License

MIT. See [`LICENSE`](LICENSE).
