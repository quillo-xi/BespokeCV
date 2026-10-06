import { analyzeResume } from '../lib/analyzer.js';
import { escapeHtml, field, scoreLabel } from './shared.js';

export function renderTargetPanel(resume, panel) {
  panel.innerHTML = `
    <div class="panel-intro"><h1>Target the actual requisition</h1><p>Paste the full job description. BespokeCV compares the language and qualification signals against evidence in your resume without sending either document to a server.</p></div>
    <div class="target-box">
      ${field('Job description', 'jobDescription', resume.jobDescription, { type: 'textarea', full: true, placeholder: 'Paste the complete posting here, including required and preferred qualifications.', rows: 18 })}
      <div class="notice"><strong>Important:</strong><span>Matching is a transparent local heuristic, not a prediction of any employer’s proprietary ATS score. Add only skills, titles, credentials, and outcomes that are accurate.</span></div>
    </div>`;
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
    <section class="form-section"><div class="section-title-row"><h2>Target-language coverage</h2><p>Truthful matches only</p></div>${resume.jobDescription.trim() ? `<p class="help">Matched terms</p><div class="keyword-wrap">${analysis.matchedKeywords.slice(0,16).map((item)=>`<span class="keyword">${escapeHtml(item.term)}</span>`).join('') || '<span class="help">No high-signal matches yet.</span>'}</div><p class="help">Potential gaps to investigate</p><div class="keyword-wrap">${analysis.missingKeywords.slice(0,16).map((item)=>`<span class="keyword missing">${escapeHtml(item.term)}</span>`).join('') || '<span class="help">No obvious keyword gaps found.</span>'}</div>` : '<p class="help">Paste a job description in Target role to activate this section.</p>'}</section>
    <section class="form-section"><div class="section-title-row"><h2>Qualification signals</h2><p>Extracted from requirement-like sentences</p></div>${analysis.requirements.length ? `<ul class="requirement-list">${analysis.requirements.map((item)=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p class="help">No explicit qualification statements detected yet.</p>'}</section>
    <section class="form-section"><div class="section-title-row"><h2>Evidence diagnostics</h2><p>Context beats keyword stuffing</p></div><p class="help"><strong>${analysis.metricCount}/${analysis.bulletCount || 0}</strong> bullets contain a measurable signal; <strong>${analysis.actionCount}/${analysis.bulletCount || 0}</strong> start with a recognized action verb. These are coaching heuristics, not hard hiring rules.</p></section>`;
}
