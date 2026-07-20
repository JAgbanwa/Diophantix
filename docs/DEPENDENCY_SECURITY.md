# Dependency advisory record

Checked on 2026-07-19 with `npm audit`.

## Resolved in this Build Week pass

- Updated Next.js and `eslint-config-next` from 16.2.6 to 16.2.10.
- Updated Playwright to 1.61.1, removing the high-severity browser-download advisory introduced by the older test runner.
- Overrode PostCSS to 8.5.20 within the supported major line, removing the runtime PostCSS/Next advisory without using `npm audit fix --force`.

## Remaining advisories

The locked tree currently reports one low and one moderate advisory:

| Package | Scope | Exposure and decision |
|---|---|---|
| `@babel/core@7.29.0` | Transitive development dependency of `eslint-plugin-react-hooks` | The advisory requires processing an attacker-controlled source map on the local build host. ProofLab does not accept or compile user source maps. A fixed version requires a major Babel override that could destabilize lint tooling, so CI tracks it without a forced upgrade. |
| `js-yaml@4.1.1` | Transitive development dependency of ESLint config loading | ProofLab does not parse user YAML. Moving to js-yaml 5 requires an out-of-range major override of ESLint's dependency. CI tracks it and fails if advisory severity reaches high. |

Both are development-tool dependencies, not packages loaded by the deployed ProofLab route. `npm run audit:ci` fails on high or critical advisories. Re-check before the immutable submission tag and upgrade when upstream ESLint/Babel releases expose compatible fixed versions.
