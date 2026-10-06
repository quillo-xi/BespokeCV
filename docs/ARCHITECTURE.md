# Architecture

BespokeCV is a local-first Progressive Web App hosted from GitHub Pages. The browser remains the primary data boundary: resume files are parsed locally, extracted resume content is stored in local storage, and no BespokeCV application server receives resume content in the baseline architecture.

## Runtime

- `site/index.html`: semantic application shell and CSP.
- `site/styles.css`: responsive, intake, review, and print styles.
- `site/app.js`: state, import, targeting, and event orchestration.
- `site/ui/`: focused rendering modules.
- `site/lib/model.js`: schema, normalization, and plain-text representation.
- `site/lib/analyzer.js`: transparent local diagnostics, phrase-aware target matching, boilerplate filtering, and requirement classification.
- `site/lib/optimizer.js`: local ideal-target blueprint, resume-evidence mapping, supporting career-source context, relevance ordering, and gap-coaching model.
- `site/lib/importers.js`: local DOCX/PDF/TXT/backup ingestion and conservative structure mapping.
- `site/lib/job-source.js`: validated public job-page retrieval and inert text extraction.
- `site/lib/docx.js`: dependency-free OOXML/DOCX generation.
- `site/lib/exporters.js`: client-side exports.
- `site/sw.js`: network-first service worker with offline fallback.

## Resume document intake

Document attachment is the preferred starting path. DOCX packages are decompressed and read entirely in the browser using web-platform compression streams. PDF text extraction uses a pinned Mozilla PDF.js build copied into `site/vendor/` during CI; the resume file is still processed client-side. TXT and BespokeCV JSON backups are also accepted. Pasted resume text and manual typing remain fallbacks.

Imported document parsing is conservative. BespokeCV stores the extracted source text locally with import metadata so users can compare the generated structured draft against the source. The parser must not invent missing dates, employers, titles, education, credentials, or accomplishments.

## Supporting career-source intake

The first workspace contains separate Resume and Job Descriptions subtabs. `careerSources` stores repeatable current/previous role-description sources. Each source has an optional label, independent free text, and at most one locally parsed DOCX/PDF/TXT attachment. Users add additional source cards to attach multiple files. At least one empty source card is always retained.

Supporting role descriptions are not merged into the resume or target-job posting. They are contextual material only: the optimizer may use them to name concrete duties, systems, processes, standards, and role terminology, but they cannot establish an accomplishment, metric, credential, degree, or required qualification by themselves.

## Job-posting URL intake

Job URLs use a browser-only retrieval boundary. `job-source.js` requires HTTPS, rejects embedded credentials, rejects nonstandard ports, blocks localhost/private-network/IP-literal destinations, rejects redirects, omits credentials and referrer data, imposes a timeout and response-size limit, permits only expected text/HTML/JSON content types, and extracts text from inert DOM or JobPosting JSON-LD.

The app never executes fetched scripts or injects fetched markup. Platforms that prohibit automated scraping, including LinkedIn and Indeed in the current reviewed policy set, are validated as outbound links but are not scraped. Users are directed to paste the posting text instead. Cross-origin protections are never bypassed; a CORS failure becomes a safe paste fallback.

## Target-concept curation

Resume schema version 3 stores `targetConceptOverrides.added` and `targetConceptOverrides.excluded`. Automatic job-posting concepts remain reproducible from the source posting; user curation is stored separately so the original posting text is never rewritten. Readiness Review and Optimized Draft resolve the same combined target set.

## Optimized-draft boundary

The optimized workspace is entirely local and deterministic. It may reorganize existing bullets by relevance and suggest target terminology only when evidence is found in the loaded resume. The hypothetical ideal blueprint is explicitly labeled reference-only. Requirements without adequate resume evidence remain annotated as gaps or items requiring manual verification; the optimizer must never invent credentials, degrees, years of experience, tools, metrics, or regulated-domain experience.

## Availability and updates

CI must pass before deployment. GitHub Pages continues serving the prior successful deployment while a new deployment is prepared. Workflow concurrency cancels obsolete in-flight runs. The service worker uses network-first retrieval, checks for updates when the app regains focus, and preserves an offline fallback.

## Data and migrations

Schema version 4 stores profile, work experience, education, certifications, skills, target-job text/source metadata, user-curated target concepts, repeatable supporting career/job-description sources, and local resume-import source metadata. JSON backup is the migration/recovery format. Future schema changes must remain backward-readable through `normalizeResume` or include an explicit migration.

## Dependency boundary

The application source remains framework-free. PDF.js is the single reviewed build-time browser dependency and is pinned to an exact version. CI stages the two required browser modules into the static site without dependency caching. No external runtime CDN is required.

## Repository operating model

`main` is the only permanent branch. Use short-lived PR branches for nontrivial work and delete them after merge. Preserve releases with tags rather than long-lived release branches. Keep a single CI/deploy workflow unless an independent cadence genuinely requires another workflow.
