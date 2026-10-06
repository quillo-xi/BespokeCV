import { analyzeResume } from '../lib/analyzer.js';
import { validateJobUrl } from '../lib/job-source.js';
import { escapeHtml, field, scoreLabel } from './shared.js';

export function renderTargetPanel(resume, panel) {
  const validation = resume.jobSourceUrl ? validateJobUrl(resume.jobSourceUrl) : null;
  const sourceLink = validation?.ok ? `<a class="safe-link" href="${escapeHtml(validation.url)}" target="_blank" rel="noopener noreferrer">Open source listing ↗</a>` : '';
  const sourceNote = validation?.ok && !validation.fetchAllowed
    ? `<div class="notice"><strong>${escapeHtml(validation.provider)} link validated:</strong><span>${escapeHtml(validation.reason)}</span></div>`
    : validation && !validation.ok
      ? `<div class="notice"><strong>URL not ready:</strong><span>${escapeHtml(validation.reason)}</span></div>`
      : '';

  panel.innerHTML = `
    <div class="panel-intro"><h1>Target the actual requisition</h1><p>Link to a public job page when available, or paste the posting. BespokeCV only reads pages through a constrained, non-credentialed browser request and never executes page scripts.</p></div>

    <section class="intake-card" aria-labelledby="job-link-title">
      <div><span class="eyebrow">Preferred when supported</span><h2 id="job-link-title">Import from a job-posting link</h2><p>HTTPS only. Local/private addresses, embedded credentials, nonstandard ports, oversized responses, redirects, and unsupported content types are blocked.</p></div>
      <div class="url-import-row">
        <label class="field full"><span>Job-posting URL</span><input type="url" data-path="jobSourceUrl" value="${escapeHtml(resume.jobSourceUrl || '')}" placeholder="https://company.example/careers/job-id" autocomplete="url"></label>
        <button class="btn primary" type="button" data-action="import-job-url">Validate & import</button>
      </div>
      ${sourceLink}
      ${sourceNote}
      <p class="help">Some sites intentionally prevent cross-site reading. BespokeCV will not bypass CORS, authentication, anti-bot controls, or a platform’s scraping restrictions.</p>
    </section>

    <section class="form-section" aria-labelledby="job-text-title">
      <div class="section-title-row"><h2 id="job-text-title">Job description</h2><p>Paste fallback and review surface</p></div>
      ${resume.jobSourceTitle || resume.jobSourceCompany ? `<div class="source-chip"><strong>${escapeHtml(resume.jobSourceTitle || 'Imported listing')}</strong>${resume.jobSourceCompany ? ` <span>· ${escapeHtml(resume.jobSourceCompany)}</span>` : ''}</div>` : ''}
      ${field('Posting text', 'jobDescription', resume.jobDescription, { type: 'textarea', full: true, placeholder: 'Paste the complete job posting here if link import is unavailable, including responsibilities and required/preferred qualifications.', rows: 18 })}
      <div class="notice"><strong>Important:</strong><span>Matching is a transparent local heuristic, not a prediction of any employer’s proprietary ATS score. Add only skills, titles, credentials, and outcomes that are accurate.</span></div>
    </section>`;
}

export function renderReviewPanel(resume, panel) {
  const analysis = analyzeResume(resume);
  const cards = [
    ['Parse integrity', analysis.parseScore, 'Core information and standard resume structure.'],
    ['Evidence strength', analysis.evidenceScore, 'Action-oriented, quantified, concise accomplishments.'],
    ['Target alignment', resume.jobDescription.trim() ? analysis.targetScore : '—', 'Overlap with high-signal job language; unscored until a posting is added.'],
    ['Human scan', analysis.scanScore, 'Headline, summary, skills focus, and skimmability.']
  ];
  panel.innerHTML = `
    <div class="panel-intro"><h1>Readiness review</h1><p>One diagnostic view for parser reliability, recruiter scan quality, evidence, and role alignment. It intentionally avoids pretending to reproduce any employer’s private ranking model.</p></div>
    <div class="score-hero"><div class="score-ring" style="--score:${analysis.overall}"><span>${analysis.overall}</span></div><div class="score-copy"><h2>${scoreLabel(analysis.overall)}</h2><p>The overall readiness score is a weighted coaching signal. Treat the recommendations and missing evidence—not the number itself—as the useful output.</p></div></div>
    <div class="score-grid">${cards.map(([label,value,detail]) => `<div class="score-card"><div class="score-card-top"><span>${label}</span><span>${value}${value === '—' ? '' : '/100'}</span></div><small>${detail}</small>${value === '—' ? '' : `<div class="meter"><span style="width:${value}%"></span></div>`}</div>`).join('')}</div>
    <section class="form-section"><div class="section-title-row"><h2>Priority recommendations</h2><p>${analysis.bulletCount} accomplishment bullets reviewed</p></div><div class="recommendations">${analysis.recommendations.map((item)=>`<article class="recommendation ${item.severity}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></article>`).join('')}</div></section>
    <section class="form-section"><div class="section-title-row"><h2>Target-language coverage</h2><p>Concept-level matching</p></div>${resume.jobDescription.trim() ? `<p class="help">Matched concepts</p><div class="keyword-wrap">${analysis.matchedKeywords.slice(0,16).map((item)=>`<span class="keyword">${escapeHtml(item.term)}</span>`).join('') || '<span class="help">No high-signal matches yet.</span>'}</div><p class="help">Unrepresented concepts to investigate</p><div class="keyword-wrap">${analysis.missingKeywords.slice(0,16).map((item)=>`<span class="keyword missing">${escapeHtml(item.term)}</span>`).join('') || '<span class="help">No obvious keyword gaps found.</span>'}</div>` : '<p class="help">Add a target job description to activate this section.</p>'}</section>
    <section class="form-section"><div class="section-title-row"><h2>Qualification signals</h2><p>Extracted from requirement-like sentences</p></div>${analysis.requirements.length ? `<ul class="requirement-list">${analysis.requirements.map((item)=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="help">No explicit qualification statements detected yet.</p>'}</section>
    <section class="form-section"><div class="section-title-row"><h2>Evidence diagnostics</h2><p>Context beats keyword stuffing</p></div><p class="help"><strong>${analysis.metricCount}/${analysis.bulletCount || 0}</strong> bullets contain a measurable signal; <strong>${analysis.actionCount}/${analysis.bulletCount || 0}</strong> start with a recognized action verb. These are coaching heuristics, not hard hiring rules.</p></section>`;
}
