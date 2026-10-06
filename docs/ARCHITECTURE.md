# Architecture

BespokeCV is a static, local-first Progressive Web App hosted from GitHub Pages. The browser is the data boundary: resume content and pasted job descriptions are stored in local storage and are not sent to GitHub or another API.

## Runtime

- `site/index.html`: semantic application shell.
- `site/styles.css`: responsive and print styles.
- `site/app.js`: state and event orchestration.
- `site/ui/`: focused rendering modules.
- `site/lib/model.js`: schema, normalization, plain-text representation.
- `site/lib/analyzer.js`: transparent local diagnostics and target matching.
- `site/lib/docx.js`: dependency-free OOXML/DOCX generation.
- `site/lib/exporters.js`: client-side exports.
- `site/sw.js`: network-first service worker with offline fallback.

## Availability and updates

CI must pass before deployment. GitHub Pages continues serving the prior successful deployment while a new deployment is prepared. Workflow concurrency cancels obsolete in-flight runs. The service worker uses network-first retrieval, checks for updates when the app regains focus, and preserves an offline fallback.

## Data and migrations

Schema version 1 stores profile, work experience, education, certifications, skills, and a target job description. JSON backup is the migration/recovery format. Future schema changes must remain backward-readable through `normalizeResume` or include an explicit migration.

## Security boundary

There are no client secrets, external runtime scripts, analytics trackers, cloud databases, or remote AI calls in the baseline. Any future cloud sync or AI integration must be opt-in and separately threat-modeled.

## Repository operating model

`main` is the only permanent branch. Use short-lived PR branches for nontrivial work and delete them after merge. Preserve releases with tags rather than long-lived release branches. Keep a single CI/deploy workflow unless an independent cadence genuinely requires another workflow.
