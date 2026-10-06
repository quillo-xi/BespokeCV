# BespokeCV

BespokeCV is a local-first resume studio designed around current ATS parsing, AI-assisted recruiting, recruiter scan behavior, and hiring-manager readability.

**Current version:** 0.1.0

## What it does

- Builds a clean single-column resume using conventional sections.
- Autosaves locally in the user's browser.
- Accepts a pasted target job description and surfaces high-signal language and qualification statements.
- Separately scores parse integrity, evidence strength, target alignment, and human scan quality.
- Flags coaching opportunities such as weak summaries, thin skills coverage, low measurable evidence, or missing target language.
- Exports a native `.docx`, ATS-readable `.txt`, browser print/PDF, and a re-importable BespokeCV JSON backup.
- Runs as a responsive Progressive Web App (PWA) on desktop and mobile browsers with an offline fallback.

The application does **not** claim to reproduce a proprietary ATS score and does not send resume/job-description content to a server.

## Production architecture

The production app is the static `site/` directory. It has no runtime or package dependencies. The only permanent branch is `main`; feature/fix branches should be short-lived. One GitHub Actions workflow performs regression checks and deploys the last passing version to GitHub Pages.

See:

- `docs/RESEARCH.md` — evidence base and source links.
- `docs/RESUME_STANDARD.md` — the resume design contract.
- `docs/ARCHITECTURE.md` — application/data/deployment architecture.
- `docs/QA.md` — automated and manual QA/QC matrix.
- `docs/ROADMAP.md` — staged product development plan.
- `SECURITY.md` — privacy and security boundary.
- `CONTRIBUTING.md` — branch, PR, and dependency policy.

## Local development

Any static file server works. For example:

```bash
python -m http.server 8080 --directory site
```

Then open `http://localhost:8080`.

Run the full dependency-free quality gate with:

```bash
npm run check
```

## GitHub Pages deployment

The workflow in `.github/workflows/ci-deploy.yml` deploys `site/` on every successful push to `main`. Pull requests run quality gates but do not deploy.

GitHub Pages must be enabled once for the repository with **Settings → Pages → Build and deployment → Source: GitHub Actions**. Because this repository is private, GitHub currently requires a plan that includes Pages for private repositories (for a personal account, GitHub Pro or higher). The published Pages site itself is public unless an organization/enterprise configuration provides private Pages access.

Expected GitHub.com project URL after Pages is enabled:

`https://quillo-xi.github.io/BespokeCV/`

## Workflow/storage discipline

- One workflow file, two jobs (quality then conditional deploy).
- No dependency cache.
- No test/build artifacts are uploaded.
- The required Pages deployment artifact has one-day retention.
- Obsolete in-flight deployments are cancelled through workflow concurrency.
- Release history should use Git tags instead of long-lived release branches.

## Privacy

Resume data is personal information. BespokeCV stores it in browser local storage; GitHub receives only the application code and deployment assets. Exported JSON backups contain the user's entered resume and target-job content and should be handled accordingly.
