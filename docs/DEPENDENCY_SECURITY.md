# Dependency advisory record

Checked on 2026-07-20 with `npm audit`.

## Resolved in this Build Week pass

- Updated Next.js and `eslint-config-next` from 16.2.6 to 16.2.10.
- Updated Playwright to 1.61.1, removing the high-severity browser-download advisory introduced by the older test runner.
- Overrode PostCSS to 8.5.20 within the supported major line, removing the runtime PostCSS/Next advisory without using `npm audit fix --force`.
- Updated compatible transitive Babel and `js-yaml` packages with `npm audit fix`, removing the remaining development-tool advisories without a major-version override.

## Remaining advisories

The locked tree currently reports **zero known vulnerabilities**. `npm run audit:ci` still fails on any future high or critical advisory, and the complete audit is re-run before the immutable submission tag.

This is a point-in-time registry result, not a guarantee that new advisories will not be published later.
