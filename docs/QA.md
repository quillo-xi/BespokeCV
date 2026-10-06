# QA / QC strategy

## Automated gate

Every pull request and push to `main` runs `npm run check`, covering unit tests, JavaScript syntax, required files, version consistency, PWA configuration, security/accessibility shell markers, and a core source-size budget.

Unit coverage includes target keyword extraction, requirement extraction, scoring behavior, standard linearized resume headings, and DOCX package generation.

## Manual release matrix

For meaningful UI or export changes, test current major browsers on Windows (Edge, Chrome, Firefox), macOS/iMac (Safari, Chrome, Firefox), iPhone/iPad (Safari and installed web app), and Android (Chrome and installed PWA). Check editing, autosave, readiness analysis, narrow layouts, DOCX/TXT export, print/PDF, installation, update behavior, and offline reopen where applicable.

Responsive spot checks: 320, 375, 768, 1024, 1366, 1440, and wide desktop widths.

## Resume regression checklist

Contact information must remain in the document body. Output must remain one logical column with standard headings. DOCX must open without a repair prompt. TXT must preserve the same substantive content in linear reading order. Printed PDF must omit application chrome. Do not introduce hidden keyword stuffing, white text, tables, columns, graphics, or unsupported claims.

## Rollback

Production deploys only after quality passes. If a deployment fails, the prior successful Pages deployment remains the baseline. Revert the offending commit or correct it through a short-lived fix branch.
