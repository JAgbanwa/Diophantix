# OpenAI Build Week submission checklist

## Product gate

- [ ] `https://www.diophantix.com/api/prooflab` returns `prooflab-api-2`, not a 404.
- [ ] Health says `connected` in a fresh incognito session.
- [ ] `OPENAI_API_KEY` and `OPENAI_PROOFLAB_MODEL=gpt-5.6` are configured in production.
- [ ] Upstash managed rate-limit variables, including `PROOFLAB_RATE_LIMIT_SALT`, are configured.
- [ ] OpenAI project spend/rate limits and alerts are configured.
- [ ] False family → `DISPROVED` with an exact counterexample.
- [ ] True identity → `PROVED`; downloaded certificate replays locally.
- [ ] Modular impossibility → `PROVED` via modulus 4.
- [ ] “Try to break this argument” runs on all three cases.
- [ ] Production deployment smoke workflow passes in `live` mode.

## Evidence gate

- [ ] Full 60-case model eval run is saved in `frontend/evals/latest-results.json`.
- [ ] Full 12-case attack-plan eval is saved in `frontend/evals/latest-attack-results.json`.
- [ ] `falseProvedCount` is zero and measured failures are disclosed.
- [ ] Attack eval has 100% `postPolicySafetyPercent`; raw model-plan misses are disclosed.
- [ ] `npm run verify:prooflab` passes at the submission commit.
- [ ] GitHub Actions and production smoke are green.
- [ ] 3–5 real user sessions are recorded using `USER_TESTING_PROTOCOL.md`.
- [ ] Quotes and task-completion figures are accurate and permissioned.

## Submission gate

- [ ] README first screen links directly to ProofLab and the three examples.
- [ ] Pre-Build Week baseline `81e3a229af489f2a81f97deeb1e32d2a3019681f` is linked.
- [ ] Submission uses the immutable `build-week-2026-submission` tag/commit.
- [ ] Devpost category is **Education**.
- [ ] Description focuses on the new ProofLab work, not legacy solver features.
- [ ] Public YouTube demo is under three minutes and includes audio.
- [ ] Demo explains the problem, GPT-5.6 role, deterministic boundary, Codex role, and impact.
- [ ] Repository setup, sample data, testing instructions, and limitations are complete.
- [ ] `/feedback` was run in the Build Week Codex task and its session ID is in Devpost.
- [ ] No invented metrics, traction, quotes, signatures, or theorem-prover claims.
