# QA / QC strategy

## Automated gate

Every pull request and push to `main` stages the pinned PDF.js assets and runs `npm run check`. The gate covers unit tests, JavaScript syntax, required files, version consistency, PWA configuration, security/accessibility shell markers, safe job-URL controls, PDF.js pinning, and a core source-size budget.

Unit coverage includes phrase-aware target extraction, nested-term de-duplication, boilerplate filtering, requirement extraction, coaching-plan requirement and prioritization behavior, scoring behavior, standard linearized resume headings, DOCX package generation, DOCX text extraction, conservative resume-text mapping, and job-URL validation/restricted-source behavior.

The UI gate also rejects reintroduction of helper/example text tied to a specific Clinical Quality Coordinator / Pharmacy Technician / sterile-compounding background.

## Manual release matrix

For meaningful UI, import, or export changes, test current major browsers on Windows (Edge, Chrome, Firefox), macOS/iMac (Safari, Chrome, Firefox), iPhone/iPad (Safari and installed web app), and Android (Chrome and installed PWA). Check DOCX/PDF/TXT resume import, repeatable supporting job-description file/text intake, add/remove/clear behavior, conservative draft mapping, manual/paste fallback, autosave, target URL validation, restricted-platform fallback, generic public job-page import where CORS allows, readiness analysis, narrow layouts, DOCX/TXT export, print/PDF, installation, update behavior, and offline reopen.

Responsive spot checks: 320, 375, 768, 1024, 1366, 1440, and wide desktop widths.

## Resume-import regression checklist

The original file must never be uploaded to a BespokeCV server in the 0.2 architecture. DOCX and PDF text extraction must remain local. File size limits must be enforced. Parsed fields must be reviewable and uncertain structure must not be guessed into populated fields. Header locations must map to City, state / region rather than Professional headline. A Professional headline should populate only when a positive headline signal is present; otherwise it remains blank. The extracted source text must remain available in the local backup for audit/recovery.

## Supporting job-description regression checklist

At least one source card must always exist. Additional cards may be added/removed dynamically. Free text and attached-document text must remain independent so either can be cleared without destroying the other. DOCX/PDF/TXT extraction stays local and follows the same document-size boundary as resume import. Supporting role-description text must survive normalization/backup and must never be treated as accomplishment or qualification proof. Coaching may use relevant source sentences for more specific prompts while keeping requirement coverage based on resume evidence.

## Job-link security regression checklist

Only HTTPS is accepted. Embedded credentials, private/local/IP-literal destinations, nonstandard ports, redirects, oversized responses, and unexpected content types must be rejected. Requests must omit credentials and referrer data. Fetched markup must be treated as inert input, not executed or directly injected. LinkedIn and Indeed URLs must remain link-only/paste-fallback sources unless an approved official integration replaces that policy.

## Coaching regression checklist

Coaching must produce a target-specific plan rather than a generic replacement resume. The workspace should show prioritized changes, headline/summary guidance, skill ordering, work-experience relevance, requirement coaching, source-informed prompts, and a final checklist. Requirement states are limited to Covered, Needs detail, and Not shown yet. Requirement extraction must respect qualification-section headings, exclude headings/culture/benefits copy, and separate timing prefixes such as `Upon hire` from the requirement text. Readiness Review and Coaching must use the same structured requirement set and coverage status. Credential requirements must inspect Certifications as the primary credential source and tolerate equivalent profession/jurisdiction/issuing-body wording without confusing adjacent professions. Supporting job-description context must never move a requirement to Covered by itself. User-curated concept exclusions/additions must remain aligned between Readiness Review and Coaching.

User-facing coaching copy should stay practical and plain-language. Repeated warning language such as “fabricated,” “truthful,” “evidence gap,” or “never auto-filled” should not return to the Coaching UI; one concise accuracy note is sufficient.

## Resume-output regression checklist

Contact information must remain in the document body. Output must remain one logical column with standard headings. DOCX must open without a repair prompt. TXT must preserve the same substantive content in linear reading order. Printed PDF must omit application chrome. Do not introduce hidden keyword stuffing, white text, tables, columns, graphics, or unsupported claims.

## Rollback

Production deploys only after quality passes. If a deployment fails, the prior successful Pages deployment remains the baseline. Revert the offending commit or correct it through a short-lived fix branch.


## Evidence diagnostic examples

Evidence diagnostics must recognize common resume action verbs and simple third-person inflections without requiring an artificially narrow verb list. Resume-specific examples must be built from actual accomplishment bullets. Rewrites may reorganize wording or derive a count from items explicitly listed in the source bullet, but they must not invent quantities. If no usable measure is present, the UI should ask a specific measurement question instead of inserting a placeholder number. At least one regression case must protect a combined action+metric rewrite and one must protect the no-number fallback.
