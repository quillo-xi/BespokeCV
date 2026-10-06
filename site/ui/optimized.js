import { buildCoachingPlan } from '../lib/optimizer.js';
import { escapeHtml } from './shared.js';

function statusMeta(status) {
  if (status === 'covered') return { label: 'Covered', tone: 'covered' };
  if (status === 'detail') return { label: 'Needs detail', tone: 'detail' };
  return { label: 'Not shown yet', tone: 'not-shown' };
}

function renderPriority(item, index) {
  return `<article class="coach-priority ${escapeHtml(item.priority)}">
    <div class="coach-priority-number">${index + 1}</div>
    <div>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.detail)}</p>
    </div>
  </article>`;
}

function renderRequirement(item) {
  const meta = statusMeta(item.status);
  const evidence = item.evidence?.length
    ? `<div class="coach-evidence"><strong>Already visible in your resume</strong><ul>${item.evidence.map((entry) => `<li><span>${escapeHtml(entry.label)}</span> — ${escapeHtml(entry.text)}</li>`).join('')}</ul></div>`
    : '';
  const sourceContext = item.sourceContext?.length
    ? `<div class="coach-source-context"><strong>Useful context from your job descriptions</strong><ul>${item.sourceContext.map((entry) => `<li><span>${escapeHtml(entry.label)}</span> — ${escapeHtml(entry.text)}</li>`).join('')}</ul></div>`
    : '';

  return `<article class="coach-requirement ${meta.tone}">
    <div class="coach-requirement-head">
      <span class="coach-status ${meta.tone}">${escapeHtml(meta.label)}</span>
      <span class="coach-requirement-meta">${item.timing ? `<span class="coach-timing">${escapeHtml(item.timing)}</span>` : ''}<span class="coach-requirement-type">${escapeHtml(item.type)}</span></span>
    </div>
    <p class="coach-requirement-text">${escapeHtml(item.text)}</p>
    ${evidence}
    ${sourceContext}
    <p class="coach-advice"><strong>How to improve it:</strong> ${escapeHtml(item.comment)}</p>
  </article>`;
}

function renderBulletSignals(item) {
  const labels = (item.quality?.signals ?? []).slice(0, 4).map((signal) => signal.label);
  return labels.length
    ? `<div class="keyword-wrap small">${labels.map((label) => `<span class="evidence-criteria">${escapeHtml(label)}</span>`).join('')}</div>`
    : '';
}

function renderExperience(role, { hasTarget = false } = {}) {
  const dates = [role.start, role.current ? 'Present' : role.end].filter(Boolean).join(' – ');
  const leadBullets = hasTarget
    ? role.bullets.filter((item) => item.score > 0)
    : role.bullets.filter((item) => item.quality?.level !== 'thin').slice(0, 4);
  const leadKeys = new Set(leadBullets.map((item) => item.index));
  const otherBullets = role.bullets.filter((item) => !leadKeys.has(item.index));
  const strengthen = role.bullets
    .filter((item) => item.quality?.level !== 'strong' && item.quality?.questions?.length)
    .slice(0, 3);

  return `<article class="coach-role">
    <div class="coach-role-head">
      <div>
        <h3>${escapeHtml(role.title || 'Role')}</h3>
        <p>${escapeHtml([role.company, role.location].filter(Boolean).join(' | '))}</p>
      </div>
      <span>${escapeHtml(dates)}</span>
    </div>

    ${leadBullets.length ? `
      <div class="coach-role-section">
        <strong>${hasTarget ? 'Lead with these bullets' : 'Strongest bullets to keep prominent'}</strong>
        <p class="help">${hasTarget ? 'These combine target relevance with the quality of the evidence already in the bullet.' : 'These currently give the clearest picture of capability, context, scope, or impact.'}</p>
        <ol class="coach-bullet-list">
          ${leadBullets.map((item) => `<li>
            <p>${escapeHtml(item.bullet)}</p>
            ${item.matches.length ? `<div class="keyword-wrap small">${item.matches.map((term) => `<span class="keyword">${escapeHtml(term)}</span>`).join('')}</div>` : ''}
            ${renderBulletSignals(item)}
          </li>`).join('')}
        </ol>
      </div>` : `
      <div class="coach-role-section">
        <strong>This role needs more context</strong>
        <p class="help">The bullets describe duties, but the reader gets limited information about scope, complexity, ownership, standards, audience, or results.</p>
      </div>`}

    ${strengthen.length ? `
      <div class="coach-strengthen-list">
        <strong>Best bullets to strengthen</strong>
        ${strengthen.map((item) => `<article>
          <p>${escapeHtml(item.bullet)}</p>
          ${renderBulletSignals(item)}
          <ul>${item.quality.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ul>
        </article>`).join('')}
      </div>` : ''}

    ${otherBullets.length ? `
      <details class="coach-secondary-bullets">
        <summary>See ${otherBullets.length} other bullet${otherBullets.length === 1 ? '' : 's'}</summary>
        <ul>${otherBullets.map((item) => `<li>${escapeHtml(item.bullet)}</li>`).join('')}</ul>
      </details>` : ''}

    ${role.sourceSuggestions?.length ? `
      <div class="coach-role-source">
        <strong>Details you may be able to add</strong>
        <p class="help">These came from the job-description sources you added for this role.</p>
        ${role.sourceSuggestions.map((item) => `<div class="coach-source-suggestion">
          <span class="coach-source-label">${escapeHtml(item.label)}</span>
          <p>${escapeHtml(item.text)}</p>
          ${item.terms.length ? `<div class="keyword-wrap small">${item.terms.map((term) => `<span class="keyword">${escapeHtml(term)}</span>`).join('')}</div>` : ''}
          <small>${escapeHtml(item.prompt)}</small>
        </div>`).join('')}
      </div>` : ''}
  </article>`;
}
function renderSkillPriority(item) {
  return `<span class="coach-skill ${item.score > 0 ? 'relevant' : ''}">
    ${escapeHtml(item.skill)}
    ${item.matches.length ? `<small>${escapeHtml(item.matches.join(' · '))}</small>` : ''}
  </span>`;
}

function renderConsistencyIssue(item) {
  return `<li class="coach-consistency ${escapeHtml(item.severity)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></li>`;
}

function renderEvidenceCandidate(item) {
  return `<li><strong>${escapeHtml(item.roleLabel || 'Work experience')}</strong><span>${escapeHtml(item.bullet)}</span></li>`;
}

function renderChecklistItem(item) {
  return `<li class="${item.done ? 'done' : 'open'}"><span aria-hidden="true">${item.done ? '✓' : '○'}</span><p>${escapeHtml(item.text)}</p></li>`;
}

export function renderCoachingPanel(resume, panel) {
  const hasTarget = Boolean(resume.jobDescription?.trim());
  const plan = buildCoachingPlan(resume);
  const targetLabel = [plan.targetTitle !== 'Target role' ? plan.targetTitle : '', plan.company].filter(Boolean).join(' at ');
  const openRequirements = plan.requirements.filter((item) => item.status !== 'covered').length;
  const quality = plan.generalQuality;

  panel.innerHTML = `
    <div class="panel-intro coaching-intro">
      <span class="eyebrow">${hasTarget ? 'Tailor this resume' : 'Improve this resume'}</span>
      <h1>Coaching</h1>
      <p>${hasTarget
        ? (targetLabel ? `Use this plan to shape your resume for <strong>${escapeHtml(targetLabel)}</strong>.` : 'Use this plan to shape your resume for the target job.')
        : 'Start with a strong general resume, then add a target job when you are ready to tailor it.'}
        Work from the top down: make the opening clear, keep the strongest evidence easy to find, strengthen task-only bullets, and finish with consistency checks.</p>
      <div class="coach-accuracy-note"><strong>Keep it yours:</strong> use the suggestions that fit your experience, and keep dates, credentials, numbers, and results exact.</div>
      ${!hasTarget ? '<div class="notice"><strong>General coaching is active:</strong><span>Add a posting in Target role to unlock requirement coverage, target concepts, and job-specific bullet ordering.</span></div>' : ''}
    </div>

    <section class="coach-snapshot ${hasTarget ? 'four' : 'three'}" aria-label="Resume coaching snapshot">
      <article><strong>${plan.snapshot.strongBullets}/${plan.snapshot.totalBullets}</strong><span>bullets with strong evidence and context</span></article>
      <article><strong>${plan.snapshot.contextRichBullets}/${plan.snapshot.totalBullets}</strong><span>bullets with meaningful context signals</span></article>
      ${hasTarget ? `<article><strong>${plan.snapshot.matchedConcepts}/${plan.snapshot.totalConcepts}</strong><span>target concepts already visible</span></article>
      <article><strong>${plan.snapshot.requiredCovered}${plan.snapshot.requiredTotal ? `/${plan.snapshot.requiredTotal}` : ''}</strong><span>required items easy to find${plan.snapshot.requiredTotal ? '' : ' — none detected'}</span></article>` :
      `<article><strong>${quality.consistencyIssues.length}</strong><span>consistency item${quality.consistencyIssues.length === 1 ? '' : 's'} to review</span></article>`}
    </section>

    <section class="coach-section coach-start">
      <div class="section-title-row"><div><h2>Start here</h2><p>Your highest-value changes${hasTarget ? ' for this application' : ''}</p></div></div>
      <div class="coach-priority-list">
        ${plan.priorities.length ? plan.priorities.map(renderPriority).join('') : '<p class="help">The resume has a strong baseline. Use the sections below for refinement.</p>'}
      </div>
    </section>

    ${quality.strengths.length ? `
      <section class="coach-section coach-strengths">
        <div class="section-title-row"><div><h2>What is already working</h2><p>Keep these strengths visible while you edit</p></div></div>
        <ul>${quality.strengths.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </section>` : ''}

    ${hasTarget ? `
      <section class="coach-section">
        <div class="section-title-row"><div><h2>What this job seems to care about most</h2><p>Use these ideas to guide emphasis, not to repeat the posting word-for-word</p></div></div>
        <div class="coach-concept-grid">
          <div>
            <h3>Already working in your favor</h3>
            <div class="keyword-wrap">${plan.strengths.length ? plan.strengths.map((item) => `<span class="keyword">${escapeHtml(item.term)}</span>`).join('') : '<span class="help">No strong concept matches are visible yet.</span>'}</div>
          </div>
          <div>
            <h3>Worth exploring</h3>
            <div class="keyword-wrap">${plan.opportunities.length ? plan.opportunities.map((item) => `<span class="keyword missing">${escapeHtml(item.term)}</span>`).join('') : '<span class="help">No major target concepts are missing.</span>'}</div>
          </div>
        </div>
        ${plan.sourceOpportunities.length ? `
          <div class="coach-source-opportunities">
            <strong>Your job descriptions may help with these</strong>
            <div class="keyword-wrap">${plan.sourceOpportunities.map((item) => `<span class="keyword source">${escapeHtml(item.term)}</span>`).join('')}</div>
            <p class="help">These ideas appear in your current/previous role descriptions but are not easy to find in the resume yet. Check whether they belong in your experience.</p>
          </div>` : ''}
      </section>` : ''}

    <section class="coach-section">
      <div class="section-title-row"><div><h2>Headline & summary</h2><p>Make the first few seconds count</p></div></div>
      <div class="coach-writing-grid">
        <article class="coach-writing-card">
          <span class="eyebrow">Headline</span>
          <h3>Suggested direction</h3>
          <div class="coach-suggestion">${escapeHtml(plan.headline.suggested)}</div>
          ${plan.headline.current ? `<details><summary>Current headline</summary><p>${escapeHtml(plan.headline.current)}</p></details>` : ''}
          <p class="help">${escapeHtml(plan.headline.reason)}</p>
        </article>
        <article class="coach-writing-card">
          <span class="eyebrow">Professional summary</span>
          <h3>Starter to work from</h3>
          <div class="coach-suggestion paragraph">${escapeHtml(plan.summary.suggested)}</div>
          ${plan.summary.current ? `<details><summary>Current summary</summary><p>${escapeHtml(plan.summary.current)}</p></details>` : ''}
          <p class="help">${escapeHtml(plan.summary.reason)}</p>
          ${plan.summary.evidenceToConsider?.length ? `<details class="coach-summary-evidence"><summary>Evidence worth considering for the summary</summary><ul>${plan.summary.evidenceToConsider.map(renderEvidenceCandidate).join('')}</ul></details>` : ''}
        </article>
      </div>
    </section>

    <section class="coach-section">
      <div class="section-title-row"><div><h2>Skills</h2><p>${hasTarget ? 'Put the most useful skills first and keep the list focused' : 'Keep the list concrete, recognizable, and supported by experience'}</p></div></div>
      <div class="coach-skills-layout">
        <div>
          <h3>${hasTarget ? 'Suggested order' : 'Current skills'}</h3>
          <div class="coach-skill-list">
            ${plan.skills.prioritized.length ? plan.skills.prioritized.map(renderSkillPriority).join('') : '<span class="help">Add a focused skills list in the Resume tab.</span>'}
          </div>
        </div>
        <div>
          <h3>${hasTarget ? 'Consider adding from your existing resume evidence' : 'Skills section check'}</h3>
          ${hasTarget
            ? `<div class="keyword-wrap">${plan.skills.addFromResumeEvidence.length ? plan.skills.addFromResumeEvidence.map((term) => `<span class="keyword">${escapeHtml(term)}</span>`).join('') : '<span class="help">No obvious additions found.</span>'}</div>`
            : `<p class="help">${resume.skills.filter(Boolean).length >= 6 && resume.skills.filter(Boolean).length <= 18 ? 'The skills list is within a practical scan range.' : 'Aim for a focused list of recognizable tools, methods, credentials, and domain skills rather than an exhaustive keyword bank.'}</p>`}
        </div>
      </div>
      ${hasTarget && plan.skills.exploreFromJobDescriptions.length ? `
        <div class="coach-source-opportunities">
          <strong>Also mentioned in your job-description sources</strong>
          <div class="keyword-wrap">${plan.skills.exploreFromJobDescriptions.map((item) => `<span class="keyword source">${escapeHtml(item.term)}</span>`).join('')}</div>
          <p class="help">If these were part of your work, they may belong in Skills or in a work-experience bullet.</p>
        </div>` : ''}
    </section>

    <section class="coach-section">
      <div class="section-title-row"><div><h2>Work experience</h2><p>${hasTarget ? 'Combine target relevance with strong evidence' : 'Turn duties into clear evidence of capability, scope, complexity, and results'}</p></div></div>
      <div class="coach-role-list">${plan.experiences.map((role) => renderExperience(role, { hasTarget })).join('')}</div>
    </section>

    ${hasTarget ? `
      <section class="coach-section">
        <div class="section-title-row">
          <div><h2>Requirement coaching</h2><p>Make the employer’s must-haves and preferences easy to see</p></div>
          <span class="coach-open-count">${openRequirements} item${openRequirements === 1 ? '' : 's'} to review</span>
        </div>
        <div class="coach-requirement-key">
          <span><i class="key-dot supported"></i>Covered</span>
          <span><i class="key-dot review"></i>Needs detail</span>
          <span><i class="key-dot gap"></i>Not shown yet</span>
        </div>
        <div class="coach-requirement-list">
          ${plan.requirements.length ? plan.requirements.map(renderRequirement).join('') : '<p class="help">No clear required/preferred statements were detected in the posting. Use target concepts and work-experience coaching as the main guide.</p>'}
        </div>
      </section>` : ''}

    ${plan.careerContext.alignedSources.length ? `
      <section class="coach-section">
        <div class="section-title-row"><div><h2>What your job descriptions add</h2><p>Extra context that may help you remember useful detail</p></div></div>
        <div class="career-alignment-list">${plan.careerContext.alignedSources.map((source) => `<article><strong>${escapeHtml(source.label)}</strong><div class="keyword-wrap">${source.matchedTerms.map((term) => `<span class="keyword source">${escapeHtml(term)}</span>`).join('')}</div></article>`).join('')}</div>
      </section>` : ''}

    ${quality.consistencyIssues.length ? `
      <section class="coach-section">
        <div class="section-title-row"><div><h2>Consistency & polish</h2><p>Small issues that can make a resume feel unfinished</p></div></div>
        <ul class="coach-consistency-list">${quality.consistencyIssues.map(renderConsistencyIssue).join('')}</ul>
      </section>` : ''}

    <section class="coach-section coach-final">
      <div class="section-title-row"><div><h2>Final pass before you apply</h2><p>A quick review checklist</p></div></div>
      <ul class="coach-checklist">${plan.checklist.map(renderChecklistItem).join('')}</ul>
      <div class="coach-next-step">
        <strong>Then make the edits in Resume.</strong>
        <span>Use Preview and Readiness review for the final check${hasTarget ? ', and save a separate tailored copy for this application' : ''}.</span>
      </div>
    </section>
  `;
}
// Compatibility export while older references are removed.
export const renderOptimizedPanel = renderCoachingPanel;
