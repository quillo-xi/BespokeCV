# BespokeCV

BespokeCV is a local-first resume studio designed around current ATS parsing, AI-assisted recruiting, recruiter scan behavior, and hiring-manager readability.

**Current version:** 0.3.1

## What it does

- Starts from an existing Word (.docx) or PDF resume by default, with TXT, backup import, paste, and manual entry as fallbacks.
- Parses resume documents locally in the browser and creates an editable structured draft without sending the file to a BespokeCV server. Multi-page import cleanup removes common page-footers, rejoins wrapped accomplishment bullets, distinguishes employment duration from location, and maps common school/program/date patterns more reliably.
- Builds a clean single-column resume using conventional sections and autosaves locally.
- Accepts a public job-posting URL, validates it through a constrained security policy, and extracts job text when the source permits safe cross-origin reading.
- Treats restricted sources such as LinkedIn and Indeed as validated outbound links with paste fallback rather than bypassing platform protections or scraping restrictions.
- Accepts pasted job descriptions and surfaces canonical, concept-level target language and required/preferred qualification signals while filtering common legal/employment boilerplate.
- Separately scores parse integrity, evidence strength, target alignment, and human scan quality.
- Adds an Optimized Draft workspace with a hypothetical ideal-target blueprint, an evidence-grounded personalized draft, and redline-style gap comments for unsupported or uncertain requirements.
- Exports a native `.docx`, ATS-readable `.txt`, browser print/PDF, and a re-importable BespokeCV JSON backup.
- Runs as a responsive Progressive Web App (PWA) on desktop and mobile browsers with an offline fallback.

The application does **not** claim to reproduce a proprietary ATS score. Resume files and resume content remain local in the baseline architecture. A job-link import makes a credential-free HTTPS request directly from the user's browser to the source page; the request is subject to strict validation, CORS, size/content limits, and inert text extraction.

## Production architecture

The production app is the static `site/` directory. It is framework-free. Mozilla PDF.js is the single pinned build-time browser dependency used for robust local PDF text extraction; CI copies the reviewed modules into the static site so production does not depend on an external runtime CDN.

The only permanent branch is `main`; feature/fix branches should be short-lived. One GitHub Actions workflow performs regression checks and deploys the last passing version to GitHub Pages.

See:

- `docs/RESEARCH.md` — evidence base and source links.
- `docs/RESUME_STANDARD.md` — the resume design contract.
- `docs/ARCHITECTURE.md` — application/data/deployment architecture.
- `docs/QA.md` — automated and manual QA/QC matrix.
- `docs/ROADMAP.md` — staged product development plan.
- `SECURITY.md` — privacy and security boundary.
- `CONTRIBUTING.md` — branch, PR, and dependency policy.

## Local development

Install the exact reviewed development dependency, stage the browser PDF modules, and run a static server:

```bash
npm install --ignore-scripts --omit=optional --package-lock=false --no-audit --no-fund
npm run vendor
python -m http.server 8080 --directory site
```

Then open `http://localhost:8080`.

Run the full quality gate with:

```bash
npm run check
```

## GitHub Pages deployment

The workflow in `.github/workflows/ci-deploy.yml` stages PDF.js, runs regression gates, and deploys `site/` on every successful push to `main`. Pull requests run quality gates but do not deploy.

Production URL:

`https://quillo-xi.github.io/BespokeCV/`

## Workflow/storage discipline

- One workflow file, two jobs (quality then conditional deploy).
- No dependency cache.
- No test/build artifacts are uploaded.
- The required Pages deployment artifact has one-day retention.
- Obsolete in-flight deployments are cancelled through workflow concurrency.
- Release history should use Git tags instead of long-lived release branches.

## Privacy

Resume data is personal information. BespokeCV stores editable data and imported source text in browser local storage; GitHub receives only the application code and deployment assets. Exported JSON backups contain the user's entered/imported resume and target-job content and should be handled accordingly.
