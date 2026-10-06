# Contributing

## Branch model

`main` is the only permanent development branch. Use short-lived branches only for work that benefits from review, then delete them after merge. Releases are preserved with tags rather than long-lived release branches.

Suggested branch names: `feat/...`, `fix/...`, `docs/...`, `chore/...`.

## Required checks

Install/stage the pinned PDF parser before the full gate:

```bash
npm install --ignore-scripts --omit=optional --package-lock=false --no-audit --no-fund
npm run vendor
npm run check
```

A change is not ready to merge if it breaks the local-first resume privacy model, job-URL safety controls, single-column resume output, existing imports/exports, or the mobile layout.

## Pull requests

Keep PRs narrow. Describe the user problem, implementation, risk, test coverage, and rollback path. Update documentation in the same PR when behavior changes.

## Dependency policy

BespokeCV remains framework-free and has one approved build-time browser dependency: Mozilla `pdfjs-dist`, pinned to an exact reviewed version for local PDF extraction. Do not add another dependency unless its value clearly exceeds its security, maintenance, bundle-size, browser-compatibility, and Actions-cost burden. Runtime CDN dependencies are not permitted by default.
