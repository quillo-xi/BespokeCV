import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md',
  'docs/ARCHITECTURE.md', 'docs/QA.md', 'docs/RESUME_STANDARD.md', 'docs/RESEARCH.md', 'docs/ROADMAP.md',
  'site/index.html', 'site/styles.css', 'site/app.js', 'site/sw.js', 'site/manifest.webmanifest', 'site/version.json',
  'site/lib/model.js', 'site/lib/analyzer.js', 'site/lib/docx.js', 'site/lib/exporters.js',
  'site/ui/shared.js', 'site/ui/editor.js', 'site/ui/review.js', 'site/ui/preview.js',
  'site/assets/icon.svg', 'site/assets/icon-192.png', 'site/assets/icon-512.png',
  '.github/workflows/ci-deploy.yml'
];

const failures = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`);

const html = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');
for (const needle of ['name="viewport"', 'Content-Security-Policy', 'class="skip-link"', 'rel="manifest"', 'aria-label="Resume editor"']) {
  if (!html.includes(needle)) failures.push(`index.html missing accessibility/security marker: ${needle}`);
}
if (/<script(?![^>]*src=)[^>]*>/i.test(html)) failures.push('Inline scripts are not allowed by the site CSP.');
if (/(?:src|href)=["']https?:\/\//i.test(html)) failures.push('External runtime assets are not allowed in index.html.');

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'site/manifest.webmanifest'), 'utf8'));
if (manifest.start_url !== './' || manifest.scope !== './') failures.push('PWA manifest must remain repository-subpath safe.');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) failures.push('PWA manifest requires install icons.');

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'site/version.json'), 'utf8')).version;
if (pkg.version !== version) failures.push('package.json and site/version.json versions differ.');
const model = fs.readFileSync(path.join(root, 'site/lib/model.js'), 'utf8');
if (!model.includes(`APP_VERSION = '${version}'`)) failures.push('APP_VERSION does not match release version.');
const sw = fs.readFileSync(path.join(root, 'site/sw.js'), 'utf8');
if (!sw.includes(`bespokecv-v${version}`)) failures.push('Service-worker cache version does not match release version.');

for (const file of ['site/app.js','site/sw.js','site/lib/model.js','site/lib/analyzer.js','site/lib/docx.js','site/lib/exporters.js','site/ui/shared.js','site/ui/editor.js','site/ui/review.js','site/ui/preview.js']) {
  try { execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' }); }
  catch (error) { failures.push(`JavaScript syntax check failed: ${file}\n${error.stderr?.toString() ?? error.message}`); }
}

const publicFiles = ['site/index.html','site/styles.css','site/app.js','site/sw.js','site/lib/model.js','site/lib/analyzer.js','site/lib/docx.js','site/lib/exporters.js','site/ui/shared.js','site/ui/editor.js','site/ui/review.js','site/ui/preview.js','site/ui/shared.js','site/ui/editor.js','site/ui/review.js','site/ui/preview.js'];
const publicBytes = publicFiles.reduce((sum, file) => sum + fs.statSync(path.join(root, file)).size, 0);
if (publicBytes > 240_000) failures.push(`Core app exceeded 240 KB source budget (${publicBytes} bytes).`);

if (failures.length) {
  console.error(`Quality gate failed with ${failures.length} issue(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Quality gate passed. Core app source: ${publicBytes} bytes.`);
