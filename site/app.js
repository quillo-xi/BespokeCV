import { APP_VERSION, createBlankResume, createEducation, createExperience, normalizeResume } from './lib/model.js';
import { copyPlainText, downloadBackup, downloadDocx, downloadTxt } from './lib/exporters.js';
import { renderResumeEditor } from './ui/editor.js';
import { renderTargetPanel, renderReviewPanel } from './ui/review.js';
import { renderPreview } from './ui/preview.js';

const STORAGE_KEY = 'bespokecv.resume.v1';
const $ = (selector) => document.querySelector(selector);
const resumePanel = $('#resumePanel');
const targetPanel = $('#targetPanel');
const reviewPanel = $('#reviewPanel');
const preview = $('#resumePreview');
const saveStatus = $('#saveStatus');
const toast = $('#toast');
let deferredInstallPrompt = null;
let saveTimer = null;
let resume = loadResume();

function loadResume() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeResume(JSON.parse(saved)) : createBlankResume();
  } catch {
    return createBlankResume();
  }
}

function scheduleSave() {
  saveStatus.textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
    const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
    saveStatus.textContent = `Saved locally · ${time}`;
  }, 250);
}

function setByPath(path, value) {
  const parts = path.split('.');
  let target = resume;
  for (let index = 0; index < parts.length - 1; index += 1) target = target[parts[index]];
  target[parts.at(-1)] = value;
}

function renderAll({ editor = true } = {}) {
  if (editor) renderResumeEditor(resume, resumePanel);
  renderTargetPanel(resume, targetPanel);
  renderReviewPanel(resume, reviewPanel);
  renderPreview(resume, preview);
}

function handleInput(event) {
  const el = event.target;
  const path = el.dataset.path;
  if (!path) return;
  if (path === 'skillsText') resume.skills = el.value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  else if (path === 'certificationsText') resume.certifications = el.value.split(/\n/).map((item) => item.trim()).filter(Boolean);
  else setByPath(path, el.type === 'checkbox' ? el.checked : el.value);
  scheduleSave();
  renderPreview(resume, preview);
  renderReviewPanel(resume, reviewPanel);
}

function handleEditorClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'add-experience') resume.experiences.push(createExperience());
  if (action === 'remove-experience') resume.experiences.splice(Number(button.dataset.index), 1);
  if (action === 'add-bullet') resume.experiences[Number(button.dataset.index)].bullets.push('');
  if (action === 'remove-bullet') resume.experiences[Number(button.dataset.role)].bullets.splice(Number(button.dataset.bullet), 1);
  if (action === 'add-education') resume.education.push(createEducation());
  if (action === 'remove-education') resume.education.splice(Number(button.dataset.index), 1);
  scheduleSave();
  renderAll();
}

function switchMode(mode) {
  for (const button of document.querySelectorAll('.mode-tab[data-mode]')) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  }
  resumePanel.hidden = mode !== 'resume';
  targetPanel.hidden = mode !== 'target';
  reviewPanel.hidden = mode !== 'review';
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 2200);
}

function closeExportMenu() {
  $('#exportMenu').hidden = true;
  $('#exportButton').setAttribute('aria-expanded', 'false');
}

function newResume() {
  if (!confirm('Start a new resume? Export a BespokeCV backup first if you want to keep the current version.')) return;
  resume = createBlankResume();
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  scheduleSave();
  showToast('New resume started');
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    resume = normalizeResume(data);
    renderAll();
    scheduleSave();
    showToast('Backup imported');
  } catch {
    showToast('Could not import that BespokeCV backup');
  }
}

function bindEvents() {
  resumePanel.addEventListener('input', handleInput);
  resumePanel.addEventListener('change', handleInput);
  targetPanel.addEventListener('input', handleInput);
  resumePanel.addEventListener('click', handleEditorClick);

  document.querySelector('.mode-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');
    if (button) switchMode(button.dataset.mode);
  });

  $('#previewToggle').addEventListener('click', () => {
    const active = document.body.classList.toggle('preview-mode');
    $('#previewToggle').setAttribute('aria-pressed', String(active));
    $('#previewToggle').textContent = active ? 'Editor' : 'Preview';
  });

  $('#newButton').addEventListener('click', newResume);
  $('#importButton').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) importBackup(file);
    event.target.value = '';
  });

  $('#printButton').addEventListener('click', () => window.print());
  $('#copyButton').addEventListener('click', async () => {
    try { await copyPlainText(resume); showToast('Resume text copied'); }
    catch { showToast('Copy failed; use the TXT export instead'); }
  });

  $('#exportButton').addEventListener('click', () => {
    const menu = $('#exportMenu');
    menu.hidden = !menu.hidden;
    $('#exportButton').setAttribute('aria-expanded', String(!menu.hidden));
  });
  $('#exportMenu').addEventListener('click', (event) => {
    const button = event.target.closest('[data-export]');
    if (!button) return;
    const type = button.dataset.export;
    if (type === 'docx') downloadDocx(resume);
    if (type === 'pdf') window.print();
    if (type === 'txt') downloadTxt(resume);
    if (type === 'json') downloadBackup(resume);
    closeExportMenu();
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#exportMenu') && !event.target.closest('#exportButton')) closeExportMenu();
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('#installButton').hidden = false;
  });
  $('#installButton').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('#installButton').hidden = true;
  });
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    window.addEventListener('focus', () => registration.update());
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem('bespokecv-reloaded')) return;
      sessionStorage.setItem('bespokecv-reloaded', '1');
      location.reload();
    });
  } catch {
    // The app remains fully usable online even if service-worker registration is unavailable.
  }
}

renderAll();
bindEvents();
registerServiceWorker();
console.info(`BespokeCV ${APP_VERSION}`);
