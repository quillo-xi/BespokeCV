# Security policy

BespokeCV is intentionally local-first. Resume content and pasted job descriptions are stored in the browser's local storage and are not transmitted by the application. The production site does not require an account, backend API, analytics service, or third-party runtime script.

## Reporting a vulnerability

Open a private GitHub security advisory for repository vulnerabilities when available. Do not place real resume data, private contact details, or employer-confidential job materials in a public issue.

## Security design constraints

- No API keys or secrets in client code.
- No remote AI calls in the baseline application.
- No external runtime JavaScript, fonts, or trackers.
- A restrictive Content Security Policy is declared in the application shell.
- GitHub Actions permissions are job-scoped and read-only except for the Pages deployment job.
- Deployment artifacts are retained for one day and no QA artifacts are uploaded by default.
