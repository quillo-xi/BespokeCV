# Security policy

BespokeCV is intentionally local-first. Resume files, extracted resume text, pasted job descriptions, and editable resume data are stored and processed in the user's browser in the 0.2 baseline. The production site does not require an account, application backend, analytics service, or remote AI provider.

## Resume document boundary

DOCX, PDF, and TXT files are processed locally. PDF parsing uses a pinned Mozilla PDF.js browser build that CI copies into the deployed static site; the user's document is not sent to Mozilla, GitHub, or a BespokeCV server. Imported source text is sensitive and is included in local storage and BespokeCV JSON backups.

## Job-link boundary

A user may ask BespokeCV to read a public job page. Before a request, BespokeCV validates the URL and permits HTTPS only. It rejects embedded credentials, local/private/IP-literal hosts, nonstandard ports, and unusually long URLs. Fetches omit cookies/credentials and referrer information, reject redirects, enforce a short timeout and 2 MB response limit, and accept only expected text/HTML/JSON content types.

Fetched HTML is parsed as inert input. Scripts, frames, embedded objects, forms, SVG/canvas content, navigation chrome, and executable markup are never executed or inserted into the application. Only extracted text and selected structured JobPosting metadata enter the local resume project.

BespokeCV does not bypass CORS, authentication, anti-bot controls, access limits, or scraping restrictions. LinkedIn and Indeed are currently treated as validated outbound links with a paste-text fallback rather than automated scraping.

## Reporting a vulnerability

Open a private GitHub security advisory for repository vulnerabilities when available. Do not place real resume data, private contact details, or employer-confidential job materials in a public issue.

## Security design constraints

- No API keys or secrets in client code.
- No remote AI calls in the baseline application.
- No external runtime JavaScript or web-font CDN.
- A restrictive Content Security Policy is declared in the application shell; HTTPS network access is reserved for the validated job-page importer.
- GitHub Actions permissions are job-scoped and read-only except for the Pages deployment job.
- Deployment artifacts are retained for one day and no QA artifacts are uploaded by default.
