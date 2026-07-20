# ProofLab model evaluation

`claim-extraction.json` is a 60-case, task-specific corpus. It keeps model extraction evaluation separate from deterministic verifier tests and covers valid and false identities, concrete assignments, non-existence claims, unsupported prose, side conditions, and prompt injection.

Run the complete corpus against the configured GPT-5.6 model:

```bash
OPENAI_API_KEY=... npm run eval:prooflab -- --write
```

For a cheaper prompt-development sample:

```bash
PROOFLAB_EVAL_LIMIT=12 npm run eval:prooflab
```

The report includes schema validity, claim-type accuracy, authoritative-equation preservation, assumption recall, variable extraction accuracy, unsupported-case accuracy, latency, token use, and the count of forbidden proof-status fields. `falseProvedCount` must remain zero. Do not publish a result file until the full corpus has actually run; an absent `latest-results.json` means no baseline has been claimed.
