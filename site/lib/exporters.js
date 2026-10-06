import { createDocxBlob } from './docx.js';
import { resumeToPlainText } from './model.js';

function fileStem(resume) {
  return (resume.profile.fullName || 'Resume').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Resume';
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBackup(resume) {
  triggerDownload(new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' }), `${fileStem(resume)}-BespokeCV.json`);
}

export function downloadTxt(resume) {
  triggerDownload(new Blob([resumeToPlainText(resume)], { type: 'text/plain;charset=utf-8' }), `${fileStem(resume)}-ATS.txt`);
}

export function downloadDocx(resume) {
  triggerDownload(createDocxBlob(resume), `${fileStem(resume)}.docx`);
}

export async function copyPlainText(resume) {
  await navigator.clipboard.writeText(resumeToPlainText(resume));
}
