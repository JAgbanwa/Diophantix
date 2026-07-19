# Diophantix

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Diophantix is an open web environment for computational Diophantine analysis.** It searches for integer and rational points, explores polynomial structure and elliptic curves, and now includes **ProofLab**: an evidence-first GPT-5.6 workflow that distinguishes proof, disproof, bounded verification, experimental evidence, conjecture, and an honestly unresolved result.

- Website: <https://www.diophantix.com>
- ProofLab: <https://www.diophantix.com/prooflab>
- Solver: <https://www.diophantix.com/app>
- Source: <https://github.com/JAgbanwa/Diophantix>

## ProofLab

Mathematical AI can produce persuasive prose without making clear what has actually been established. ProofLab enforces a hard evidence boundary:

1. **GPT-5.6 interprets** the user's equation, claim, formulas, variables, and assumptions.
2. A strict schema converts that interpretation into a small proof obligation.
3. **Deterministic exact code** evaluates the obligation.
4. Only the deterministic verifier may assign the final status.
5. Proved and disproved results carry a SHA-256-hashed certificate that the server replays before returning it.
6. An adversarial mode asks GPT-5.6 how to attack the argument, then executes those attacks deterministically.
7. A portable proof capsule binds the input, obligation, verdict, provenance, and certificate into one independently replayable artifact.

> **Invariant:** model output has no field capable of assigning `PROVED`. That status requires a replayable verifier certificate.

### Supported ProofLab obligations

| Obligation | Deterministic method | Possible global result |
|---|---|---|
| Polynomial parameterization | Exact substitution and expansion over `ℤ` | `PROVED` or `DISPROVED` |
| Concrete integer assignment | Exact integer evaluation | `PROVED` or `DISPROVED` |
| Claimed non-existence | Complete residue enumeration modulo selected moduli | `PROVED` if an obstruction is found |
| Failed modular/small search | Explicitly bounded evidence | `UNKNOWN`, never silently upgraded |

### Status semantics

| Status | Meaning |
|---|---|
| `PROVED` | A supported global claim has a replayable deterministic certificate. |
| `DISPROVED` | An exact counterexample or contradiction has a replayable certificate. |
| `VERIFIED_IN_RANGE` | A complete finite range was checked, without a global conclusion. |
| `EXPERIMENTAL_EVIDENCE` | Incomplete computational evidence was collected. |
| `CONJECTURAL` | A pattern was identified but not proved. |
| `UNKNOWN` | The available verifier language does not settle the claim. |

### Demo cases

#### Correct identity

```text
Equation: x^2 + y^2 = z^2
Claim: For every integer t, the formulas produce a solution.
Formulas:
  x = t^2 - 1
  y = 2*t
  z = t^2 + 1
```

ProofLab substitutes exactly and obtains residual `0`, so it issues a `symbolic_identity_v1` certificate. This proves the formulas produce solutions; it does **not** prove every Pythagorean triple is represented.

#### False identity

```text
Equation: x^2 + y^2 = z^2
Claim: For every integer t, the formulas produce a solution.
Formulas:
  x = t^2 + 1
  y = 2*t
  z = t^2 - 1
```

The exact residual is `8*t^2`. A deterministic interpolation argument constructs `t = 1`, where the residual is `8`, and the universal claim is `DISPROVED`.

#### Congruence obstruction

```text
Equation: x^2 + y^2 = 4*z + 3
Claim: There are no integer solutions.
```

ProofLab checks every residue triple modulo `4`. No assignment works, so the modular obstruction proves global non-existence.

## Existing Diophantix capabilities

- Search `y² = f(n, x)` families with exact perfect-square checks.
- Search general polynomial equations in `x`, `y`, and an optional parameter `n`.
- Integer and bounded rational-point searches.
- Large-integer fallback using Python arbitrary-precision arithmetic.
- Quadratic-residue pre-sieves for large scans.
- Live Server-Sent Events result streaming.
- Curve plotting and sampled three-dimensional views.
- Elliptic-curve invariants for supported cubic models.
- Exact rational group-law calculations.
- Torsion and finite-field exploration tools.
- Congruence-obstruction proof attempts.
- Equation Explorer and experimental conjecture detection.
- CSV, PDF, LaTeX, and BibTeX export.
- Search history, mathematical memory, light/dark mode, and multilingual UI.

## Architecture

```text
Browser
├── /prooflab                         Next.js ProofLab interface
├── /api/prooflab                     Native Next.js server route
│   ├── GPT-5.6 structured extraction
│   ├── strict runtime schema validation
│   ├── deterministic verifier
│   ├── certificate replay
│   └── adversarial review
├── /api/prooflab/replay              Independent proof-capsule replay
├── /app                              Existing solver interface
└── /api/*                            Existing Flask/SymPy/NumPy backend
```

### ProofLab files

```text
frontend/src/app/prooflab/
├── layout.tsx
├── page.tsx
└── prooflab.css

frontend/src/app/api/prooflab/
├── route.js
└── replay/route.js

frontend/src/lib/prooflab/
├── demos.mjs
├── schemas.mjs
├── verifier.mjs
└── verifier.test.mjs

frontend/scripts/
└── verify-proof-capsule.mjs
```

The proof core is dependency-free JavaScript and uses `BigInt` polynomial coefficients. It accepts integer coefficients, identifiers, `+`, `-`, `*`, parentheses, and nonnegative integer powers. It deliberately rejects division instead of pretending that denominator side conditions have been verified.

## Local development

### 1. Clone

```bash
git clone https://github.com/JAgbanwa/Diophantix.git
cd Diophantix
```

### 2. Start the Flask backend

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The backend listens on `http://localhost:5001` by default.

### 3. Configure the Next.js frontend

```bash
cd frontend
cp .env.example .env.local
```

Set:

```dotenv
OPENAI_API_KEY=your_server_side_api_key
OPENAI_PROOFLAB_MODEL=gpt-5.6
PROOFLAB_SAFETY_SALT=a_long_random_server_side_secret
FLASK_INTERNAL_URL=http://127.0.0.1:5001
```

Never expose the key with a `NEXT_PUBLIC_` prefix.

### 4. Install and run

```bash
npm ci
npm run dev
```

Open:

- <http://localhost:3000/prooflab>
- <http://localhost:3000/app>

Native Next.js route handlers take priority over the Flask rewrite, so `/api/prooflab` remains server-side in Next.js while the existing `/api/*` endpoints continue to reach Flask.

## Quality checks

```bash
cd frontend
npm run check
```

This runs ESLint, 21 deterministic verifier tests, TypeScript validation, and a production build. The suite covers:

- a correct polynomial identity;
- a false identity and exact counterexample;
- resistance to a forged model-supplied proof status;
- a complete modular obstruction;
- a false non-existence claim with an exact solution;
- unsupported division;
- adversarial cancellation checks;
- evidence-ledger scope;
- certificate and capsule replay, semantic-forgery resistance, and tamper detection;
- every keyless showcase demo and unsupported-claim boundaries.

Downloaded capsules can also be verified offline:

```bash
npm run verify:capsule -- path/to/result.proof.json
```

## API behavior

### Health

```http
GET /api/prooflab
```

Returns the configured model, whether `OPENAI_API_KEY` is available, and the proof-status policy.

### Keyless showcase demo

```http
POST /api/prooflab
Content-Type: application/json

{
  "mode": "demo",
  "demoId": "true-identity"
}
```

The three authored examples remain fully functional without an OpenAI key. They exercise the same deterministic verifier and capsule policy used after model interpretation.

### Analyze

```http
POST /api/prooflab
Content-Type: application/json

{
  "mode": "analyze",
  "equation": "x^2 + y^2 = z^2",
  "claim": "For every integer t, these formulas produce a solution.",
  "proposedArgument": "x=t^2-1\ny=2*t\nz=t^2+1"
}
```

The user's equation is authoritative. GPT-5.6 may extract the obligation, but it cannot replace the equation or assign the result.

### Adversarial review

```http
POST /api/prooflab
Content-Type: application/json

{
  "mode": "attack",
  "equation": "...",
  "claim": "...",
  "proposedArgument": "...",
  "obligation": { "...": "the validated obligation returned by analyze" }
}
```

The server validates the obligation, recomputes the deterministic result, obtains a structured attack plan from GPT-5.6, and runs both mandatory and model-proposed checks.

### Replay a proof capsule

```http
POST /api/prooflab/replay
Content-Type: application/json

{
  "capsule": { "...": "downloaded ProofLab artifact" }
}
```

The endpoint checks both SHA-256 integrity layers, enforces the certificate's exact claim semantics, and reruns the underlying verifier. Invalid artifacts receive HTTP `422`.

## Safety and trust boundaries

- OpenAI calls occur only in the server route.
- Public model requests carry a stable HMAC-derived safety identifier rather than a raw network address.
- Inputs and model outputs have strict size and schema limits.
- A best-effort per-address rate limit protects the public endpoint.
- Model requests have an abort timeout.
- Mathematical expressions are parsed by a small allow-list grammar.
- Arbitrary JavaScript execution is never used by ProofLab.
- Exact certificate replay occurs before a proof response is returned.
- Only `PROVED` and `DISPROVED` results may contain a proof certificate; unresolved results cannot masquerade as certified artifacts.
- Extra assumptions are displayed but not silently treated as machine-checked.
- A failed search is never described as proof.

## Current limitations

ProofLab is intentionally not a universal theorem prover. The first certificate language does not yet cover:

- rational functions or denominator side conditions;
- inequalities, positivity, coprimality, or divisibility constraints as formal assumptions;
- induction, infinite descent, algebraic number fields, or elliptic-curve descent;
- completeness of a parameterization;
- substitution formulas that depend on other target variables (rewrite them directly in independent parameters);
- arbitrary natural-language proofs;
- Lean, Coq, or Isabelle kernel certificates.

Unsupported claims receive `UNKNOWN`. This is a product feature, not an error: the system is designed to state the strength of its evidence honestly.

## OpenAI Build Week

The pre-existing Diophantix baseline is commit:

```text
81e3a229af489f2a81f97deeb1e32d2a3019681f
```

ProofLab, its deterministic verifier, GPT-5.6 structured workflow, adversarial review, certificate policy, tests, and integration documentation were added as the Build Week contribution. See [`BUILD_WEEK.md`](BUILD_WEEK.md) for the exact separation.

## License

MIT. See [`LICENSE`](LICENSE).
