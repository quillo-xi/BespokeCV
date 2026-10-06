import { APP_VERSION, createBlankResume, createCareerSource, createEducation, createExperience, normalizeResume } from './lib/model.js';
import { copyPlainText, downloadBackup, downloadDocx, downloadTxt } from './lib/exporters.js';
import { importResumeFile, importSupportingDocument, parseResumeText } from './lib/importers.js';
import { fetchJobPosting } from './lib/job-source.js';
import { renderResumeEditor } from './ui/editor.js';
import { renderTargetPanel, renderReviewPanel } from './ui/review.js';
import { renderOptimizedPanel } from './ui/optimized.js';
import { renderPreview } from './ui/preview.js';

const STORAGE_KEY = 'bespokecv.resume.v1';
const $ = (selector) => document.querySelector(selector);
const resumePanel = $('#resumePanel');
const targetPanel = $('#targetPanel');
const optimizedPanel = $('#optimizedPanel');
const reviewPanel = $('#reviewPanel');
const preview = $('#resumePreview');
const saveStatus = $('#saveStatus');
const toast = $('#toast');
let deferredInstallPrompt = null;
let saveTimer = null;
let targetConceptEditMode = false;
let resumeContentTab = 'resume';
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

function renderReview() {
  renderReviewPanel(resume, reviewPanel, { editConcepts: targetConceptEditMode });
}

function renderAll({ editor = true } = {}) {
  if (editor) renderResumeEditor(resume, resumePanel, { activeTab: resumeContentTab });
  renderTargetPanel(resume, targetPanel);
  renderOptimizedPanel(resume, optimizedPanel);
  renderReview();
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
  renderOptimizedPanel(resume, optimizedPanel);
  renderReview();
}

function handleEditorClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  if (button.dataset.resumeSubtab) {
    resumeContentTab = button.dataset.resumeSubtab;
    renderResumeEditor(resume, resumePanel, { activeTab: resumeContentTab });
    return;
  }

  if (action === 'upload-resume') { $('#importFile').click(); return; }
  if (action === 'import-pasted-resume') {
    const text = $('#resumePasteText')?.value?.trim();
    if (!text) { showToast('Paste resume text first'); return; }
    applyImportedResume(parseResumeText(text, { fileName: 'Pasted resume text', format: 'text' }), 'Resume text imported');
    return;
  }
  if (action === 'add-experience') resume.experiences.push(createExperience());
  if (action === 'remove-experience') resume.experiences.splice(Number(button.dataset.index), 1);
  if (action === 'add-bullet') resume.experiences[Number(button.dataset.index)].bullets.push('');
  if (action === 'remove-bullet') resume.experiences[Number(button.dataset.role)].bullets.splice(Number(button.dataset.bullet), 1);
  if (action === 'add-education') resume.education.push(createEducation());
  if (action === 'remove-education') resume.education.splice(Number(button.dataset.index), 1);
  if (action === 'add-career-source') resume.careerSources.push(createCareerSource());
  if (action === 'remove-career-source' && resume.careerSources.length > 1) resume.careerSources.splice(Number(button.dataset.index), 1);
  if (action === 'clear-career-text') resume.careerSources[Number(button.dataset.index)].text = '';
  if (action === 'clear-career-file') {
    const source = resume.careerSources[Number(button.dataset.index)];
    source.fileName = '';
    source.fileFormat = '';
    source.fileText = '';
    source.importedAt = '';
  }
  scheduleSave();
  renderAll();
}

async function handleTargetClick(event) {
  const button = event.target.closest('[data-action="import-job-url"]');
  if (!button) return;
  const url = resume.jobSourceUrl?.trim();
  if (!url) { showToast('Enter a job-posting URL first'); return; }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Checking…';
  try {
    const result = await fetchJobPosting(url);
    resume.jobSourceUrl = result.url;
    if (result.restricted) {
      scheduleSave();
      renderTargetPanel(resume, targetPanel);
      showToast(`${result.provider} link validated; paste the posting text`);
      return;
    }
    resume.jobDescription = result.description;
    resume.jobSourceTitle = result.title;
    resume.jobSourceCompany = result.company;
    scheduleSave();
    renderAll({ editor: false });
    showToast('Job posting imported safely');
  } catch (error) {
    showToast(error?.message || 'Could not import that job posting');
    renderTargetPanel(resume, targetPanel);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

function ensureConceptOverrides() {
  if (!resume.targetConceptOverrides || typeof resume.targetConceptOverrides !== 'object') {
    resume.targetConceptOverrides = { added: [], excluded: [] };
  }
  if (!Array.isArray(resume.targetConceptOverrides.added)) resume.targetConceptOverrides.added = [];
  if (!Array.isArray(resume.targetConceptOverrides.excluded)) resume.targetConceptOverrides.excluded = [];
  return resume.targetConceptOverrides;
}

function conceptKey(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function rerenderConceptSurfaces() {
  renderOptimizedPanel(resume, optimizedPanel);
  renderReview();
}

function handleReviewClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  if (action === 'toggle-concept-edit') {
    targetConceptEditMode = !targetConceptEditMode;
    renderReview();
    return;
  }

  const overrides = ensureConceptOverrides();

  if (action === 'remove-target-concept') {
    const term = String(button.dataset.term ?? '').trim();
    if (!term) return;
    const key = conceptKey(term);
    overrides.added = overrides.added.filter((item) => conceptKey(item) !== key);
    if (!overrides.excluded.some((item) => conceptKey(item) === key)) overrides.excluded.push(term);
    scheduleSave();
    rerenderConceptSurfaces();
    showToast(`${term} removed from target concepts`);
    return;
  }

  if (action === 'reset-target-concepts') {
    overrides.added = [];
    overrides.excluded = [];
    scheduleSave();
    rerenderConceptSurfaces();
    showToast('Target concepts reset to automatic detection');
  }
}

function handleReviewSubmit(event) {
  const form = event.target.closest('[data-form="add-target-concept"]');
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector('input[name="targetConcept"]');
  const term = String(input?.value ?? '').replace(/\s+/g, ' ').trim();
  if (term.length < 2) { showToast('Enter a concept first'); return; }
  if (term.length > 80) { showToast('Keep target concepts to 80 characters or fewer'); return; }

  const overrides = ensureConceptOverrides();
  const key = conceptKey(term);
  overrides.excluded = overrides.excluded.filter((item) => conceptKey(item) !== key);
  if (!overrides.added.some((item) => conceptKey(item) === key)) overrides.added.push(term);

  scheduleSave();
  rerenderConceptSurfaces();
  showToast(`${term} added to target concepts`);
}

async function importCareerSourceFile(file, index) {
  const source = resume.careerSources[index];
  if (!source) return;
  const currentLabel = saveStatus.textContent;
  saveStatus.textContent = `Reading ${file.name} locally…`;
  try {
    const result = await importSupportingDocument(file);
    source.fileName = result.fileName;
    source.fileFormat = result.format;
    source.fileText = result.text;
    source.importedAt = result.importedAt;
    scheduleSave();
    renderResumeEditor(resume, resumePanel, { activeTab: resumeContentTab });
    renderOptimizedPanel(resume, optimizedPanel);
    showToast(`${file.name} added as career evidence`);
  } catch (error) {
    saveStatus.textContent = currentLabel;
    showToast(error?.message || 'Could not read that supporting document');
  }
}

function switchMode(mode) {
  for (const button of document.querySelectorAll('.mode-tab[data-mode]')) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  }
  resumePanel.hidden = mode !== 'resume';
  targetPanel.hidden = mode !== 'target';
  optimizedPanel.hidden = mode !== 'optimized';
  reviewPanel.hidden = mode !== 'review';
  document.body.classList.toggle('optimized-mode', mode === 'optimized');
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 3600);
}

function closeExportMenu() {
  $('#exportMenu').hidden = true;
  $('#exportButton').setAttribute('aria-expanded', 'false');
}

function newResume() {
  if (!confirm('Start a new resume? Export a BespokeCV backup first if you want to keep the current version.')) return;
  resume = createBlankResume();
  targetConceptEditMode = false;
  resumeContentTab = 'resume';
  localStorage.removeItem(STORAGE_KEY);
  renderAll();
  scheduleSave();
  showToast('New resume started');
}

function preserveTargetFields(targetResume) {
  targetResume.jobDescription = resume.jobDescription;
  targetResume.jobSourceUrl = resume.jobSourceUrl;
  targetResume.jobSourceTitle = resume.jobSourceTitle;
  targetResume.jobSourceCompany = resume.jobSourceCompany;
  targetResume.targetConceptOverrides = {
    added: [...(resume.targetConceptOverrides?.added ?? [])],
    excluded: [...(resume.targetConceptOverrides?.excluded ?? [])]
  };
  targetResume.careerSources = (resume.careerSources ?? []).map((source) => ({ ...source }));
  return targetResume;
}

function applyImportedResume(imported, message, { preserveTarget = true } = {}) {
  resume = normalizeResume(preserveTarget ? preserveTargetFields(imported) : imported);
  renderAll();
  scheduleSave();
  showToast(message);
}

async function importFile(file) {
  const currentLabel = saveStatus.textContent;
  saveStatus.textContent = `Reading ${file.name} locally…`;
  try {
    const result = await importResumeFile(file);
    applyImportedResume(result.resume, result.kind === 'backup' ? 'BespokeCV backup imported' : `${file.name} imported — review the draft`, { preserveTarget: result.kind !== 'backup' });
  } catch (error) {
    saveStatus.textContent = currentLabel;
    showToast(error?.message || 'Could not import that resume');
  }
}

function bindEvents() {
  resumePanel.addEventListener('input', handleInput);
  resumePanel.addEventListener('change', (event) => {
    const fileInput = event.target.closest('[data-career-file-index]');
    if (fileInput) {
      const [file] = fileInput.files;
      if (file) importCareerSourceFile(file, Number(fileInput.dataset.careerFileIndex));
      fileInput.value = '';
      return;
    }
    handleInput(event);
  });
  targetPanel.addEventListener('input', handleInput);
  resumePanel.addEventListener('click', handleEditorClick);
  targetPanel.addEventListener('click', handleTargetClick);
  reviewPanel.addEventListener('click', handleReviewClick);
  reviewPanel.addEventListener('submit', handleReviewSubmit);

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
    if (file) importFile(file);
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
