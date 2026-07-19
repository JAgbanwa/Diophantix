# OpenAI Build Week Contribution

## Baseline

The pre-existing Diophantix project is preserved by commit:

```text
81e3a229af489f2a81f97deeb1e32d2a3019681f
```

That baseline predates the OpenAI Build Week submission period.

## Pre-existing work

Before Build Week, Diophantix already included:

- integer and rational point search;
- elliptic-curve and general polynomial modes;
- exact large-integer checks and numerical acceleration;
- live SSE result streaming;
- curve visualization and arithmetic invariants;
- group-law, torsion, finite-field, and exploration utilities;
- a congruence-obstruction endpoint;
- an experimental conjecture engine;
- export, history, memory, themes, and multilingual interface features.

These capabilities support the new workflow, but they are not presented as Build Week work.

## New Build Week work

### Product

- New `/prooflab` user experience.
- Evidence-status taxonomy: `PROVED`, `DISPROVED`, `VERIFIED_IN_RANGE`, `EXPERIMENTAL_EVIDENCE`, `CONJECTURAL`, and `UNKNOWN`.
- Evidence ledger explaining the method, result, and scope of every step.
- “Try to break this argument” adversarial review.
- Keyless authored demos for a reliable judging path without credentials.
- Downloadable, independently replayable `.proof.json` capsules.
- Browser and offline CLI verification for proof capsules.
- Updated landing page and ProofLab discoverability.

### GPT-5.6 integration

- Server-side OpenAI Responses API integration using model `gpt-5.6` by default.
- Strict JSON Schema output for claim extraction.
- Strict JSON Schema output for adversarial attack planning.
- Runtime validation after structured output.
- GPT-5.6 is confined to interpretation and planning; it cannot assign proof status.

### Deterministic verification

- Safe polynomial grammar with exact `BigInt` coefficients.
- Exact polynomial normalization, substitution, expansion, and evaluation.
- Guaranteed counterexample construction for nonzero polynomial identities by recursive interpolation.
- Complete residue enumeration for small-modulus obstructions.
- Complete bounded solution search with explicit scope.
- Replayable SHA-256-hashed certificates.
- Mandatory certificate replay before a proof response is returned.
- Semantic replay that rejects a forged certificate even if its attacker recomputes the hash.
- Capsule-level SHA-256 integrity over input, obligation, verdict, provenance, and certificate.
- Adversarial boundary, scope, assumptions, cancellation, congruence, and bounded-search checks.

### Reliability and security

- Server-only API key handling.
- Input and output size limits.
- Model timeout.
- Best-effort public endpoint rate limiting.
- No arbitrary evaluation in the ProofLab parser.
- Division is rejected rather than certified without denominator conditions.
- Model-generated statuses are ignored by the verifier.
- Stable HMAC-derived OpenAI safety identifiers avoid transmitting raw client addresses.
- GitHub Actions runs Python compilation, lint, deterministic tests, and the production build.

### Tests

The Build Week test suite contains 21 deterministic tests covering:

1. implicit multiplication and exact normalization;
2. a correct Pythagorean identity;
3. a false identity with a certified counterexample;
4. rejection of a forged model proof status;
5. a complete modulo-4 obstruction;
6. an exact solution refuting a non-existence claim;
7. honest handling of inconclusive searches;
8. rejection of unsupported division;
9. adversarial cancellation and scope checks;
10. non-authoritative GPT evidence-ledger labeling;
11. certificate tamper detection;
12. rejection of malformed GPT claim extraction;
13. restriction of adversarial plans to deterministic tool names;
14. honest handling of incomplete parameterizations;
15. preservation of unverified side conditions during counterexample search;
16. refusal to certify a concrete assignment when side conditions remain unverified;
17. rejection of dependent target-variable substitutions that would otherwise be misapplied;
18. semantic-forgery rejection after an attacker recomputes the certificate hash;
19. enforcement that unresolved results never receive proof certificates;
20. portable capsule replay and surrounding-artifact tamper detection;
21. validation and advertised verdicts for all three keyless demos.

Run:

```bash
cd frontend
npm run check
```

## Principal implementation files

```text
frontend/src/app/prooflab/layout.tsx
frontend/src/app/prooflab/page.tsx
frontend/src/app/prooflab/prooflab.css
frontend/src/app/api/prooflab/route.js
frontend/src/app/api/prooflab/replay/route.js
frontend/scripts/verify-proof-capsule.mjs
frontend/src/lib/prooflab/demos.mjs
frontend/src/lib/prooflab/schemas.mjs
frontend/src/lib/prooflab/verifier.mjs
frontend/src/lib/prooflab/verifier.test.mjs
frontend/.env.example
.github/workflows/quality.yml
```

## Claim boundary

ProofLab's first release does **not** claim to verify arbitrary mathematical prose. It certifies only obligations expressible in its deterministic language. A certificate for a parametric identity proves that the formulas generate solutions; it does not prove completeness. When the required mathematics is outside the supported language, the correct output is `UNKNOWN`.
