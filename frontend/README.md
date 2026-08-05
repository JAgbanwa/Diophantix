# ProofLab frontend

This Next.js application contains the OpenAI Build Week ProofLab experience, its server-side GPT-5.6 route, deterministic verifier, replayable certificates, evals, and browser tests.

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` and `OPENAI_PROOFLAB_MODEL=gpt-5.6` in `.env.local` for live interpretation. Without a key, the three reviewed demonstrations remain available as explicitly labeled offline replays; the deterministic verifier still runs live.

Open <http://localhost:3000/prooflab>.

## Verify

```bash
npm run verify:prooflab
npm run test:smoke
npm run audit:ci
```

The deterministic gate covers parser safety, exact verification, certificate replay and tamper detection, claim-aware adversarial policy, route precedence, differential checks against SymPy, lint, and a production build. Playwright exercises the judge path and educator prediction loop.

Live GPT-5.6 evals are deliberately separate so deterministic tests never depend on model variability:

```bash
OPENAI_API_KEY=... npm run eval:prooflab -- --write
OPENAI_API_KEY=... npm run eval:attacks -- --write
```

See the [project README](../README.md), [Build Week contribution record](../BUILD_WEEK.md), and [submission checklist](../docs/SUBMISSION_CHECKLIST.md) for the architecture, exact claims, production configuration, and limitations.
