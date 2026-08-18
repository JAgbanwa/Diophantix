# Diophantix ProofLab

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ProofLab verification](https://github.com/JAgbanwa/Diophantix/actions/workflows/prooflab.yml/badge.svg)](https://github.com/JAgbanwa/Diophantix/actions/workflows/prooflab.yml)

**A deterministic proof firewall for mathematical AI.** GPT-5.6 extracts a small, typed mathematical obligation; exact code alone proves it, refutes it, or returns `UNKNOWN` rather than dressing evidence up as a theorem.

- **Try ProofLab:** <https://www.diophantix.com/prooflab>
- **Search integer and rational points:** <https://www.diophantix.com/app>
- **Judge in 90 seconds:** false claim → true theorem → modular proof → replay → attack
- Build Week category: **Education**
- Audience: number-theory students, mathematics educators, and researchers
- Source: <https://github.com/JAgbanwa/Diophantix>

## Three judge-ready examples

| Load this example | Exact outcome | What it teaches |
|---|---|---|
| [**False family**](https://www.diophantix.com/prooflab?demo=false-family) | `DISPROVED`, with residual `8*t^2` and an exact counterexample | One counterexample refutes a universal claim. |
| [**True identity**](https://www.diophantix.com/prooflab?demo=true-identity) | `PROVED`, with a replayable identity certificate | A symbolic zero residual is stronger than checking many values. |
| [**Modular impossibility**](https://www.diophantix.com/prooflab?demo=modular-impossibility) | `PROVED`, via complete residue enumeration modulo 4 | A local obstruction can prove global integer non-existence. |

The intended journey is deliberately linear:

```text
load example → interpret → verify → replay certificate → try to break it
```

For the fastest review, open **False family**, run the verdict, and then select **Try to break this argument**. The page exposes the GPT-5.6 interpretation, the exact residual, the replay boundary, the claim-aware attack plan, and every deterministic check in one path. Switch on **Educator mode** to make a prediction before the verdict is revealed.

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

Source-backed context (advisory only)
  authoritative equation + submitted prose
    → dated, curated famous-problem registry
    → established / open / partially resolved label
    → never enters the verifier or certificate path
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

### Research-status context

When a submission clearly names or matches a reviewed landmark problem, ProofLab displays a separate **source-backed mathematical context** card. The initial registry covers Fermat's Last Theorem, sums of three cubes, and the seven Millennium Prize Problems. It correctly distinguishes, for example, the solved Poincaré conjecture from the six Millennium problems that remain open, and labels sums of three cubes as a partially resolved family rather than giving every target the same status.

Each entry includes a review date, scope warning, and links to primary or authoritative institutional sources. These labels are advisory literature metadata: they do not change an exact verdict, create a certificate, or turn `UNKNOWN` into `PROVED`. In particular, `UNKNOWN` beside an established theorem means that ProofLab's current certificate language did not reproduce the known proof.

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

## Exact rational search

The general three-variable solver now has two complementary engines:

- **ℤ fast** keeps the vectorised integer search and exact arbitrary-precision verification.
- **ℚ exact** enumerates two coordinates as every reduced fraction `p/q` in the configured intervals with projective height `max(|p|, q) ≤ H`, then chooses the lowest-degree third coordinate and finds all of its rational roots exactly.
- **3-way deep** repeats that exact projection with `x`, `n`, and `y` as the unbounded solved coordinate. Thus any one coordinate can be arbitrarily large while the other two remain inside the displayed height scope; integral `y` scan values can be prioritized.
- **Birational normalizer** detects exact surfaces of the form `y² = (λt+z)² + R(z)/t`, where `z` is affine in `n`, `t` is affine in `n,x`, and `R` is cubic. It searches the smaller coordinates and maps them back to original rational values of unrestricted height.
- **Automatic curve classifier** distinguishes genus-zero, genus-one, rational-function, and higher-genus hyperelliptic models, records symbolic singularity conditions, and reports whether an exact deep model is available.
- **Polynomial cubic fibers** use the exact scaling `X=a·x, Y=a·y` to transform `y²=a·x³+b·x²+c·x+d` into monic Weierstrass form.
- **Rational-root quartics** use `u=1/(x-r), v=y/(x-r)²` to transform a quartic fiber with rational root `r` into a cubic Weierstrass model.
- **Native Mordell–Weil expansion** converts each nonsingular normalized fiber to `Y² = X³ + a₂X² + a₄X + a₆`, applies the exact rational group law, and maps generator multiples back.
- **eqref{1.71} family engine** recognizes `y²=(36n³-19-12xn)²-(2x)³` in every point-domain mode, including **ℤ fast**. It exactly replays the 62 published nontrivial integer seed triples inside the requested `n/x` intervals and expands their fixed-`n` elliptic fibers through bounded Mordell–Weil combinations and every translate by the exact order-three section `T=(0,36n³-19)`. Catalog and generated points are labeled separately and linked to their source. Once that bounded family scope and its compact affine scan finish, the request terminates instead of falling through to redundant generic projections, so coordinate intervals such as `±10¹³` do not consume the server timeout.
- **Denominator-constrained affine scan** recognizes when requested denominator divisors turn an enormous rational-coordinate problem into an integer lattice in normalized coordinates. It factors each exact cubic remainder in a caller-supplied finite `q` interval, tests every exposed signed divisor `t`, maps hits back with `Fraction`, and reports computational and proof-grade completion separately. Complete modular checks skip locally impossible fibers, and interrupted web runs return an exact `q` checkpoint for continuation.
- **Optional SageMath 2-descent** asks a local Sage installation for Mordell–Weil generators, torsion points, 2-Selmer information, and lower/upper rank bounds with probabilistic large-prime tests disabled.
- **Optional 3-descent** requests a 3-Selmer rank through SageMath when a licensed Magma runtime is configured. Absence of Magma is returned as `unavailable`, never silently promoted to a proof.
- **Elliptic-fiber certificates** record the exact map, Weierstrass coefficients, discriminant, nonsingularity, reported curve points, attributed descent evidence, and a canonical SHA-256 digest.

The solved coordinate has no magnitude bound. For example, a linear equation can return an 80-digit rational coordinate even when its displayed interval is small; Python integers, `Fraction`, and SymPy's exact rational polynomial routines are used throughout. Linear and quadratic roots have dedicated exact paths, while higher-degree polynomials use exact rational-root factorization. Rational-polynomial equations are combined over a common denominator, solved through the exact numerator, and checked against the original denominator so poles never become false solutions. Every candidate is independently substituted back into the original equation before it is streamed.

A completed projection run is exhaustive inside the displayed height box for the two enumerated coordinates and for every rational root of the solved coordinate. The eqref{1.71} catalog replay is exhaustive only for the embedded published rows inside the displayed `n/x` intervals. Birational, Mordell–Weil, Sage-generated, and eqref{1.71} lattice results extend the height box but remain candidate generation. Rank equality is displayed only when an attributed external descent reports matching lower and upper bounds. Certificate replay independently checks payload integrity, discriminants, nonsingularity, and point membership, but does not re-prove SageMath or Magma's descent computation. Timeouts and result caps are reported as incomplete. This is a meaningful finite guarantee—not a claim that arbitrary Diophantine equations are decidable.

### Exact denominator-constrained numerator-lattice search

The large-coefficient rational equation can be searched through a much smaller exact integer lattice. Define

```text
p = 176959370426063526189820447723837571181114689072145824174813
M = 223812005206893026939939757344219979030523588763591004819297
q = 3*p*n + M
t = p*(2*x + 1)
```

Here `p` is prime, the requested denominator bounds are `3*p` for `n` and `2*p` for `x`, and the giant numerator is exactly `36*(3*p*n+M)^3-19`. The complete equation therefore becomes, without approximation,

```text
y^2 = (t + 6*q)^2 + (36*q^3 - 19)/t,    t != 0.
```

For reduced fractions, `den(n) | 3*p` and `den(x) | 2*p` are equivalent to `q,t ∈ ℤ` under this map. The unknown rational numerators are therefore represented by the integer values of `q` and `t`. Requiring integral `y` forces `t | (36*q^3-19)`, so Diophantix searches a finite integer-`q` interval by factoring each remainder, enumerating every signed divisor `t`, square-testing the resulting right-hand side, and mapping each hit back with exact `Fraction` arithmetic. The remaining predicates are checked after the inverse map:

```text
n = (q-M)/(3*p)       x = (t-p)/(2*p)
n is nonintegral  <=> q != M (mod 3*p)
x is nonintegral  <=> t != p (mod 2*p)
n != x            <=> 2*(q-M) != 3*(t-p)
```

Each returned point may also include the following optional replay identity:

```text
U = y - t             V = 2*t + 6*q             W = -t - y
```

Exact expansion gives `U^3+V^3+W^3=114`, and the inverse values are

```text
q = (U+V+W)/6         t = -(U+W)/2              y = (U-W)/2.
```

This identity is verification metadata for an emitted result; it is not used to refuse or redirect the requested rational search.

At the Python API level, the finite contract is explicit:

```python
from constrained_rational import (
    AffineIntegralDivisorPlan,
    RationalPointConstraints,
)

p = 176959370426063526189820447723837571181114689072145824174813
constraints = RationalPointConstraints(
    n_denominator_divisor=3 * p,
    x_denominator_divisor=2 * p,
    require_nonintegral_n=True,
    require_nonintegral_x=True,
    require_integral_y=True,
    require_nonzero_y=True,
    require_distinct_n_x=True,
)
scan = AffineIntegralDivisorPlan(
    surface=detected_affine_surface,
    constraints=constraints,
    q_min=-100_000,
    q_max=100_000,
    factor_limit=100_000,
)
for fiber in scan.scan_fibers():
    # Computational coverage requires both flags on every visited fiber.
    assert fiber.factorization_complete
    assert fiber.divisor_enumeration_complete
    # Proof-grade coverage additionally requires deterministic factor evidence.
    assert fiber.factorization_proof_grade
    process(fiber)
```

The general-solver UI exposes the same contract, and shared URLs retain it. Its `GET /api/diophantine` request uses `constrained_search=1`, `n_denominator_divisor`, `x_denominator_divisor`, `normalized_q_min`, `normalized_q_max`, and `factor_limit`, together with the exact predicates `require_nonintegral_n`, `require_nonintegral_x`, `require_integral_y`, `require_nonzero_y`, and `require_distinct_n_x`. Large divisor and coordinate values remain decimal strings in the SSE metadata, so browser number precision cannot alter them.

One web run may cover at most `2,000,001` consecutive `q` fibers. The hosted endpoint accepts `factor_limit` values from `1` through `250000`, bounding the effort spent on any one large remainder. Code using `AffineIntegralDivisorPlan` locally may set `factor_limit=0` to request unlimited factorization, subject to the local process's own resources. The hosted endpoint also caps positive-divisor enumeration per fiber so a highly composite remainder cannot monopolize the server.

Completion is reported at two levels:

- `computational_scope_complete=true` means the full declared `q` interval was visited, every required factorization completed within the configured effort, every resulting signed divisor was enumerated within the work cap, and no time or result limit stopped the run.
- `proof_grade_complete=true` (also exposed as `bounded_q_complete`) additionally means every reported factor has deterministic primality evidence. A computationally complete run can therefore remain short of proof-grade completion without discarding its exact verified hits.

If a time or result limit interrupts the finite interval, the final SSE event includes `resume_q` and a `checkpoint` containing the next normalized numerator coordinate and the last completed coordinate. Continue with the same equation, denominator constraints, predicates, factor effort, and `normalized_q_max`, using that `resume_q` as the new `normalized_q_min`. This partitions a large numerator search into exact, reproducible chunks instead of silently treating a server timeout as completion.

The `EXACT MAP` classification badge is interactive. It opens the verified forward and inverse substitutions, Weierstrass model, torsion section, discriminant and validity condition when those fields are available, together with the map's scope and provenance.

The solver UI exposes `Off`, `Native`, `Auto`, and `SageMath` deep-engine modes plus a bounded generator-multiple depth. `Auto` uses Sage when available and otherwise falls back to the native exact group law. To select a non-default Sage executable:

```bash
export DIOPHANTIX_SAGE_EXECUTABLE=/path/to/sage
```

Runtime capabilities are available from `GET /api/solver-capabilities`.
`POST /api/classify-curve` classifies an equation before a search, and
`POST /api/solver-certificate/replay` replays the exact assertions in an
exported elliptic-fiber certificate.

Run the focused backend suite with:

```bash
python -m unittest discover -s tests -v
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

### 2. Flask solver backend

The focused ProofLab flow is a native Next.js page and route handler. The solver uses Flask:

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

Open <http://localhost:3000/prooflab> or <http://localhost:3000/app>.

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

- 28 deterministic and randomized verifier/contract tests;
- 250 randomized parser/evaluation cases;
- 80 randomized certificate replay/tamper cases;
- 120 differential polynomial checks against SymPy;
- prompt-injection, parser-budget, unsupported-division, and route-precedence regressions;
- scoped ESLint and a deterministic `next build --webpack` production build.

GitHub Actions also installs Chromium and exercises the judge journey with Playwright. A second workflow runs against every successful deployment and daily, calling the actual deployed health endpoint, all three golden paths, certificate replay, and adversarial mode.

### Model extraction and attack-planning evaluations

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
OPENAI_API_KEY=... npm run eval:attacks -- --write
```

The 12-case attack corpus separately measures raw plan relevance, useful-strategy coverage, and post-policy safety across identities, non-existence claims, assignments, side conditions, and unsupported proof prose. Model mistakes remain visible in the report; deterministic filtering must still keep post-policy safety at 100%.

Reported metrics are schema validity, claim-type accuracy, authoritative-equation preservation, assumption recall, variable extraction accuracy, unsupported-case accuracy, attack relevance, deterministic post-policy safety, latency, token use, and forbidden proof-status fields. No metric is fabricated: absent result files mean the full baselines have not yet run and no score is claimed. This follows OpenAI's guidance on [task-specific evals](https://developers.openai.com/api/docs/guides/evaluation-best-practices) and [preventing schema/type divergence](https://developers.openai.com/api/docs/guides/structured-outputs#avoid-json-schema-divergence).

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
- Dependency CI fails on high/critical advisories. The latest locked-tree audit and remediation record is in [`docs/DEPENDENCY_SECURITY.md`](docs/DEPENDENCY_SECURITY.md).

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

The literature-status registry is deliberately finite and manually reviewed. A missing card does not imply that a problem is unknown, and every dated entry must be rechecked against its linked sources as mathematical knowledge changes. For parameterized families such as sums of three cubes, the family label also does not replace instance-specific research.

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
