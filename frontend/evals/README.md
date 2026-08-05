# ProofLab model evaluation

`claim-extraction.json` is a 60-case, task-specific corpus. It keeps model extraction evaluation separate from deterministic verifier tests and covers valid and false identities, concrete assignments, non-existence claims, unsupported prose, side conditions, and prompt injection.

`attack-planning.json` is a separate 12-case adversarial-planning corpus. It measures whether GPT-5.6 proposes checks relevant to each claim type, whether it includes a useful strategy, and whether the deterministic policy drops every inapplicable proposal before execution.

Run the complete corpus against the configured GPT-5.6 model:

```bash
OPENAI_API_KEY=... npm run eval:prooflab -- --write
OPENAI_API_KEY=... npm run eval:attacks -- --write
```

For a cheaper prompt-development sample:

```bash
PROOFLAB_EVAL_LIMIT=12 npm run eval:prooflab
```

The extraction report includes schema validity, claim-type accuracy, authoritative-equation preservation, assumption recall, variable extraction accuracy, unsupported-case accuracy, latency, token use, and the count of forbidden proof-status fields. `falseProvedCount` must remain zero.

The attack report distinguishes raw model-plan relevance from post-policy safety. A model mistake is measured, not hidden; deterministic sanitization must still make `postPolicySafetyPercent` 100. Do not publish result files until the complete corpus has actually run. Absent `latest-results.json` or `latest-attack-results.json` means that baseline has not been claimed.
