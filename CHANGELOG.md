# Changelog

## 0.3.4 — 2026-10-06

Resume-tailoring Coaching workspace.

- Repurposed the Optimized Draft tab as **Coaching**.
- Replaced the side-by-side ideal/personalized resume comparison with a practical tailoring workflow organized around what to change first.
- Added a target-job snapshot showing visible concepts, required-item coverage, and supporting job-description sources.
- Added prioritized tailoring actions, target-strength/opportunity views, headline and summary starters, skills ordering, role-by-role bullet prioritization, source-informed detail prompts, requirement coaching, and a final application checklist.
- Simplified requirement states to Covered, Needs detail, and Not shown yet.
- Reworked coaching language to be more practical and less repetitive about accuracy concerns while keeping one concise accuracy note.
- Preserved user-curated target concepts and current/previous job-description context throughout the coaching plan.
- Added regression coverage for coaching priorities, tone, source context, requirement states, and final checklist behavior.


## 0.3.3 — 2026-10-06

Career-evidence intake and source-informed optimization.

- Reconfigured the first Resume workspace into nested Resume and Job Descriptions tabs.
- Added repeatable job-description source cards with one local DOCX/PDF/TXT attachment and one independent free-text field per card.
- Users can add/remove source cards, while the final remaining card cannot be removed; its text and attached file can still be cleared independently.
- Extracted supporting-document text is stored locally with filename/format metadata and survives BespokeCV backups.
- Supporting current/previous job descriptions are kept separate from target-job postings and from resume accomplishment evidence.
- Optimized Draft now uses relevant supporting-role text to produce more concrete coaching and evidence patterns, reducing generic placeholder language.
- Job-description context never changes a requirement to Supported by itself; resume evidence remains the support boundary.
- Added schema, import, optimizer, and regression coverage for the new source model.


## 0.3.2 — 2026-10-06

User-curated target-language coverage.

- Added an Edit concepts toggle to the Readiness Review target-language section.
- Matched and unrepresented concept chips can be removed from the target set.
- Added concepts are evaluated against resume evidence and automatically appear as matched or unrepresented.
- Curated additions/exclusions persist with the resume and are used by both Readiness Review and Optimized Draft.
- Added Reset curation to restore automatic concept detection.
- Added regression coverage for persisted exclusions, manual concepts, evidence classification, and optimizer alignment.


## 0.3.1 — 2026-10-06

Target-language precision hotfix.

- Replaced arbitrary multi-word n-gram output with canonical concept extraction plus conservative repeated-term fallback.
- Added explicit handling for common standards, credentials, tools, and resume concepts such as CAPA, GCP, ICH guidelines, Microsoft Office, monitoring/auditing, and SoCRA/ACRP certification.
- Preserved useful standalone technologies when repeated while suppressing ambiguous component words.
- Renamed review labels from terms to concepts and added regression coverage for the sentence-fragment patterns observed in the UCI Quality Assurance Coordinator posting.


## 0.3.0 — 2026-10-06

Target intelligence and evidence-grounded optimized drafting.

- Added an Optimized Draft workspace with side-by-side ideal-target blueprint and personalized evidence-grounded draft.
- Required/preferred requirements are mapped to resume evidence and marked Supported, Verify/Partial, or Evidence Gap.
- Unsupported qualifications are never silently inserted; gap comments provide coaching and conditional example language.
- Target-language extraction now prefers meaningful multi-word concepts, collapses nested duplicates, stems common word variants, and filters legal/employment boilerplate and negative administrative terms.
- Existing skills and work bullets are prioritized by target relevance without changing the factual source text.
- Added regression coverage for phrase de-duplication, boilerplate filtering, evidence-grounded optimization, and unsupported-requirement visibility.

## 0.2.1 — 2026-10-06

Resume-import fidelity hotfix based on a real multi-page PDF regression review.

- Remove common `Name - page N` / `Page N` artifacts before section parsing so headers/footers do not bleed into employers, education, skills, or other fields.
- Rejoin wrapped PDF lines into the originating accomplishment bullet instead of creating fragmented one- or two-word bullets.
- Preserve internal dated sub-role markers without misclassifying them as separate employers.
- Treat parenthetical employment duration as metadata rather than a location.
- Parse education as school + program/degree + completion date, using the end year of a year range as the completion year.
- Preserve wrapped parenthetical skill names across PDF line breaks.
- Added regression coverage for multi-page footer boundaries, wrapped bullets, duration/location confusion, education ordering, completion-year selection, and wrapped skills.

## 0.2.0 — 2026-10-06

Document-first intake and safe target sourcing.

- Word (.docx), PDF, TXT, and BespokeCV backup import; document attachment is now the preferred starting workflow.
- Local DOCX extraction and pinned local PDF.js parsing with no resume upload to a BespokeCV server.
- Conservative structured-draft parsing with extracted source text retained locally for review/recovery.
- Paste-text and manual-entry fallbacks retained.
- User-facing helper/placeholder text replaced with neutral cross-industry examples; CI blocks reintroduction of the user's prior pharmacy/sterile-compounding examples.
- HTTPS job-posting URL validation and safe public-page text/JSON-LD extraction where CORS and source policy allow it.
- LinkedIn and Indeed handled as validated source links with paste fallback rather than automated scraping or protection bypass.
- Added URL safety controls for credentials, ports, private/local/IP destinations, redirects, timeouts, response size, content types, referrer/credential omission, and inert parsing.
- Expanded automated coverage and updated architecture, QA, security, contribution, and roadmap documentation.

## 0.1.0 — 2026-10-06

Initial production foundation.

- Local-first responsive resume builder.
- Single-column ATS-safe master template.
- Job-description keyword and qualification-signal analysis.
- Separate parse, evidence, target-alignment, and human-scan diagnostics.
- Native DOCX, TXT, browser PDF/print, and BespokeCV JSON backup exports.
- Installable PWA shell with network-first update behavior and offline fallback.
- Automated unit and repository quality gates.
- Single GitHub Actions workflow for CI and GitHub Pages deployment.
- Research, architecture, QA, security, contribution, and roadmap documentation.
