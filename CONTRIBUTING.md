# Contributing

## Branch model

`main` is the only permanent development branch. Use short-lived branches only for work that benefits from review, then delete them after merge. Releases are preserved with tags rather than long-lived release branches.

Suggested branch names: `feat/...`, `fix/...`, `docs/...`, `chore/...`.

## Required checks

Run:

```bash
npm run check
```

A change is not ready to merge if it breaks the local-first privacy model, single-column resume output, existing exports, or the mobile layout.

## Pull requests

Keep PRs narrow. Describe the user problem, implementation, risk, test coverage, and rollback path. Update documentation in the same PR when behavior changes.

## Dependency policy

The baseline application has zero runtime and development package dependencies. Add a dependency only when its value clearly exceeds its security, update, bundle-size, and Actions-cost burden.
