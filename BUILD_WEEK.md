# OpenAI Build Week Contribution

## Immutable baseline

The pre-existing Diophantix project is preserved by commit:

```text
81e3a229af489f2a81f97deeb1e32d2a3019681f
```

That baseline predates the Build Week submission period.

## Pre-existing work

Before Build Week, Diophantix included integer/rational point search, polynomial and elliptic-curve modes, live SSE results, visualizations, arithmetic invariants, experimental congruence/conjecture tools, export, history, themes, and multilingual UI. Those capabilities remain useful context but are not presented as Build Week work.

## New Build Week work

### Product

- New focused `/prooflab` experience.
- Consistent “deterministic proof firewall” positioning for number-theory students, educators, and researchers.
- Evidence statuses: `PROVED`, `DISPROVED`, `VERIFIED_IN_RANGE`, `EXPERIMENTAL_EVIDENCE`, `CONJECTURAL`, and `UNKNOWN`.
- One judge journey: load → interpret → verify → replay → attack.
- Evidence ledger and a visible GPT/verifier boundary beside every verdict.
- “Try to break this argument” adversarial review.
- Connected, unconfigured, endpoint-unreachable, and temporarily unavailable health states.
- Labeled offline replay for exactly three reviewed demonstrations.
- Educator mode with a required pre-verdict classification and post-verdict reflection, share links, and worksheet export.
- Actionable `UNKNOWN` reformulation guidance.

### GPT-5.6 integration

- Server-side OpenAI Responses API using `gpt-5.6` by default.
- Zod-derived strict Structured Output for claim extraction and attack planning.
- TypeScript types and model JSON Schema originate from the same contracts.
- Runtime validation after Structured Output parsing.
- GPT-5.6 is confined to interpretation and planning; neither schema contains a proof status.
- Bounded output, timeout, SDK retries, usage capture, and transient model-error classification.

### Deterministic verification

- Safe polynomial grammar with exact `BigInt` coefficients.
- Exact normalization, substitution, expansion, assignment evaluation, and counterexample construction.
- Complete residue enumeration for supported small-modulus obstructions.
- Explicitly scoped bounded solution search.
- Version 2 certificates with canonical input, certificate/schema/engine versions, timestamp, and SHA-256 integrity checksum.
- Mandatory replay before a proof response is returned.
- Standalone `npm run replay-certificate` command.
- Claim-aware adversarial boundary, scope, assumption, cancellation, congruence, and bounded-search checks.
- Deterministic filtering prevents GPT-5.6 from applying a solution-search refutation to the wrong claim type.
- Side-conditioned candidates remain inconclusive until the verifier can establish those conditions.

The checksum is documented as edit detection, not a signature or proof of authorship.

### Deployment, reliability, and security

- Repaired Vercel route precedence: filesystem/native Next functions now run before the legacy Flask `/api/*` catch-all.
- Added a regression test that locks the route order.
- Server-only API key handling and explicit production environment template.
- Request byte/field limits and parser/verifier computation budgets.
- Managed Upstash REST rate limiting across serverless instances, plus per-address and daily project budgets.
- Development-only local limiter fallback, surfaced in health state.
- Request IDs, structured trace logs, model response IDs, and usage metadata.
- CSP, frame, MIME, referrer, and permissions headers for ProofLab.
- No arbitrary expression evaluation; division is rejected instead of hiding denominator conditions.
- Updated Next.js/Playwright, safely overrode PostCSS, and applied compatible transitive fixes; the locked tree audits at zero known vulnerabilities without `--force`.
- Removed committed empty runtime log debris and added `*.log` to `.gitignore`.

### Tests and evals

The automated gate now includes 28 named deterministic/randomized tests plus:

- 250 seeded random polynomial evaluation checks;
- hostile parser and prompt-status-forgery regressions;
- exponent/input/term/modular/bounded-search budget checks;
- 80 seeded certificate replay/tamper checks;
- 120 seeded differential checks against SymPy;
- scoped ESLint and deterministic webpack production build;
- Playwright tests for the browser journey, health semantics, three golden examples, replay, and adversarial mode;
- deployment-status and daily production smoke against the actual URL.

GPT evaluation is separate from deterministic verification. The 60-case extraction corpus covers valid and false identities, assignments, non-existence, unsupported prose, side conditions, ambiguity, and prompt injection. A second 12-case corpus measures attack-plan relevance, useful-strategy coverage, and deterministic post-policy safety across every supported claim type.

Run:

```bash
cd frontend
npm run verify:prooflab
npm run test:smoke
OPENAI_API_KEY=... npm run eval:prooflab -- --write
OPENAI_API_KEY=... npm run eval:attacks -- --write
```

No model-eval metric is claimed until real full-corpus runs create the corresponding files under `frontend/evals/`.

## Principal implementation files

```text
frontend/src/app/prooflab/
frontend/src/app/api/prooflab/route.ts
frontend/src/lib/prooflab/contracts.ts
frontend/src/lib/prooflab/model.ts
frontend/src/lib/prooflab/rate-limit.mjs
frontend/src/lib/prooflab/demo-cases.ts
frontend/src/lib/prooflab/verifier.mjs
frontend/src/lib/prooflab/*.test.mjs
frontend/evals/claim-extraction.json
frontend/evals/attack-planning.json
frontend/scripts/replay-certificate.mjs
frontend/scripts/smoke-production.mjs
frontend/tests/e2e/prooflab.spec.ts
vercel.json
.github/workflows/prooflab.yml
.github/workflows/prooflab-production-smoke.yml
docs/
```

## Claim boundary

ProofLab does not verify arbitrary mathematical prose. It certifies only obligations expressible in its deterministic language. A parametric identity certificate proves that supplied formulas generate solutions; it does not prove completeness. Side-conditioned or unsupported mathematics returns `UNKNOWN` with reformulation guidance.

Lean/Coq export remains a stretch goal only after deployment, evals, and user testing are solid.

## Deployment owner actions

Credentials and external platform controls cannot be committed. Before submission, the owner must:

1. configure the production OpenAI and Upstash environment variables;
2. configure OpenAI project spend/rate limits and alerts;
3. run the live production smoke in a fresh/incognito session;
4. run and save the full 60-case GPT eval;
5. complete 3–5 honest user sessions;
6. create the immutable submission tag after all evidence is green.

See [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md).

## Codex collaboration evidence

Codex helped diagnose the deployed route collision, implement single-source contracts, offline replay, versioned certificates, operational controls, eval/test suites, accessibility-focused judge flow, and documentation. Human decisions include selecting Diophantix, defining the evidence/status philosophy, choosing the Education audience, approving scope, and validating every external claim.

The Devpost entry should include the `/feedback` session ID from the Build Week Codex task. No placeholder or invented ID belongs in the repository.
