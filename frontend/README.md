# Diophantix frontend

This directory contains the Next.js 16 interface for Diophantix, including the solver, explorer, mathematical memory, and ProofLab.

## Run locally

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open <http://localhost:3000/prooflab> for ProofLab or <http://localhost:3000/app> for the solver. ProofLab's authored demos work without credentials; free-form GPT interpretation requires `OPENAI_API_KEY` in `.env.local`. The solver and explorer also expect the Flask service at `FLASK_INTERNAL_URL`.

## Quality gate

```bash
npm run check
```

The gate runs ESLint, 21 exact-verifier tests, TypeScript checking, and the production build. Next's Webpack build path is explicit because it is the reproducible path verified in CI and on Apple Silicon.

## Proof artifacts

ProofLab can download a `.proof.json` capsule containing the original input, normalized obligation, deterministic verdict, verifier certificate, provenance, and two integrity hashes. Replay one without starting the web application:

```bash
npm run verify:capsule -- path/to/result.proof.json
```

The web verifier is available at `POST /api/prooflab/replay`. Invalid or tampered capsules return HTTP `422`.

See the repository [README](../README.md) for architecture, API examples, trust boundaries, and local Flask setup. See [BUILD_WEEK.md](../BUILD_WEEK.md) for the contribution boundary.
