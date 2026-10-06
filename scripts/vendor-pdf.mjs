import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', 'pdfjs-dist', 'build');
const destination = path.join(root, 'site', 'vendor');
const license = path.join(root, 'node_modules', 'pdfjs-dist', 'LICENSE');

for (const file of ['pdf.mjs', 'pdf.worker.mjs']) {
  const input = path.join(source, file);
  if (!fs.existsSync(input)) throw new Error(`Missing ${input}. Install the pinned pdfjs-dist development dependency first.`);
}
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(path.join(source, 'pdf.mjs'), path.join(destination, 'pdf.mjs'));
fs.copyFileSync(path.join(source, 'pdf.worker.mjs'), path.join(destination, 'pdf.worker.mjs'));
if (fs.existsSync(license)) fs.copyFileSync(license, path.join(destination, 'pdfjs-LICENSE.txt'));
console.log('Staged pinned PDF.js browser assets.');
