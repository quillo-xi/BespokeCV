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
      <span class="coach-requirement-type">${escapeHtml(item.type)}</span>
    </div>
    <p class="coach-requirement-text">${escapeHtml(item.text)}</p>
    ${evidence}
    ${sourceContext}
    <p class="coach-advice"><strong>How to improve it:</strong> ${escapeHtml(item.comment)}</p>
  </article>`;
}

function renderExperience(role) {
  const dates = [role.start, role.current ? 'Present' : role.end].filter(Boolean).join(' – ');
  const relevantBullets = role.bullets.filter((item) => item.score > 0);
  const otherBullets = role.bullets.filter((item) => item.score <= 0);

  return `<article class="coach-role">
    <div class="coach-role-head">
      <div>
        <h3>${escapeHtml(role.title || 'Role')}</h3>
        <p>${escapeHtml([role.company, role.location].filter(Boolean).join(' | '))}</p>
      </div>
      <span>${escapeHtml(dates)}</span>
    </div>

    ${relevantBullets.length ? `
      <div class="coach-role-section">
        <strong>Lead with these bullets</strong>
        <p class="help">These have the clearest connection to the target job. Keeping the strongest ones first makes the role easier to scan.</p>
        <ol class="coach-bullet-list">
          ${relevantBullets.map((item) => `<li>
            <p>${escapeHtml(item.bullet)}</p>
            ${item.matches.length ? `<div class="keyword-wrap small">${item.matches.map((term) => `<span class="keyword">${escapeHtml(term)}</span>`).join('')}</div>` : ''}
          </li>`).join('')}
        </ol>
      </div>` : `
      <div class="coach-role-section">
        <strong>No strong target match is obvious yet</strong>
        <p class="help">This does not mean the role is irrelevant. Look for transferable work, tools, scale, leadership, quality, customer, technical, or process experience that connects to the posting.</p>
      </div>`}

    ${otherBullets.length ? `
      <details class="coach-secondary-bullets">
        <summary>See ${otherBullets.length} lower-priority bullet${otherBullets.length === 1 ? '' : 's'}</summary>
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

function renderChecklistItem(item) {
  return `<li class="${item.done ? 'done' : 'open'}"><span aria-hidden="true">${item.done ? '✓' : '○'}</span><p>${escapeHtml(item.text)}</p></li>`;
}

export function renderCoachingPanel(resume, panel) {
  if (!resume.jobDescription?.trim()) {
    panel.innerHTML = `
      <div class="panel-intro">
        <h1>Coaching</h1>
        <p>Use this workspace to tailor your resume for a specific position. Add the target job first, then BespokeCV can show what to emphasize, what to move higher, and where more detail could help.</p>
      </div>
      <div class="notice"><strong>Add a target role first:</strong><span>Open Target role and paste or import the job posting to build a tailored coaching plan.</span></div>`;
    return;
  }

  const plan = buildCoachingPlan(resume);
  const targetLabel = [plan.targetTitle !== 'Target role' ? plan.targetTitle : '', plan.company].filter(Boolean).join(' at ');
  const openRequirements = plan.requirements.filter((item) => item.status !== 'covered').length;

  panel.innerHTML = `
    <div class="panel-intro coaching-intro">
      <span class="eyebrow">Tailor this resume</span>
      <h1>Coaching</h1>
      <p>${targetLabel ? `Use this plan to shape your resume for <strong>${escapeHtml(targetLabel)}</strong>.` : 'Use this plan to shape your resume for the target job.'} Work from the top down: sharpen the opening, move the most relevant skills and accomplishments forward, then fill in useful detail.</p>
      <div class="coach-accuracy-note"><strong>Keep it yours:</strong> use the suggestions that fit your experience, and keep dates, credentials, numbers, and results exact.</div>
    </div>

    <section class="coach-snapshot" aria-label="Tailoring snapshot">
      <article><strong>${plan.snapshot.matchedConcepts}</strong><span>of ${plan.snapshot.totalConcepts} target concepts already visible</span></article>
      <article><strong>${plan.snapshot.requiredCovered}${plan.snapshot.requiredTotal ? `/${plan.snapshot.requiredTotal}` : ''}</strong><span>required items easy to find${plan.snapshot.requiredTotal ? '' : ' — none detected'}</span></article>
      <article><strong>${plan.snapshot.careerSourceCount}</strong><span>job-description source${plan.snapshot.careerSourceCount === 1 ? '' : 's'} helping with detail</span></article>
    </section>

    <section class="coach-section coach-start">
      <div class="section-title-row"><div><h2>Start here</h2><p>Your highest-value changes for this application</p></div></div>
      <div class="coach-priority-list">
        ${plan.priorities.length ? plan.priorities.map(renderPriority).join('') : '<p class="help">The resume is already well aligned. Use the sections below for a final polish.</p>'}
      </div>
    </section>

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
    </section>

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
        </article>
      </div>
    </section>

    <section class="coach-section">
      <div class="section-title-row"><div><h2>Skills</h2><p>Put the most useful skills first and keep the list focused</p></div></div>
      <div class="coach-skills-layout">
        <div>
          <h3>Suggested order</h3>
          <div class="coach-skill-list">
            ${plan.skills.prioritized.length ? plan.skills.prioritized.map(renderSkillPriority).join('') : '<span class="help">Add a focused skills list in the Resume tab.</span>'}
          </div>
        </div>
        <div>
          <h3>Consider adding from your existing resume evidence</h3>
          <div class="keyword-wrap">${plan.skills.addFromResumeEvidence.length ? plan.skills.addFromResumeEvidence.map((term) => `<span class="keyword">${escapeHtml(term)}</span>`).join('') : '<span class="help">No obvious additions found.</span>'}</div>
        </div>
      </div>
      ${plan.skills.exploreFromJobDescriptions.length ? `
        <div class="coach-source-opportunities">
          <strong>Also mentioned in your job-description sources</strong>
          <div class="keyword-wrap">${plan.skills.exploreFromJobDescriptions.map((item) => `<span class="keyword source">${escapeHtml(item.term)}</span>`).join('')}</div>
          <p class="help">If these were part of your work, they may belong in Skills or in a work-experience bullet.</p>
        </div>` : ''}
    </section>

    <section class="coach-section">
      <div class="section-title-row"><div><h2>Work experience</h2><p>Lead with the work that matters most for this application</p></div></div>
      <div class="coach-role-list">${plan.experiences.map(renderExperience).join('')}</div>
    </section>

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
        ${plan.requirements.length ? plan.requirements.map(renderRequirement).join('') : '<p class="help">No clear required/preferred statements were detected in the posting. Use the target concepts and work-experience sections above as the main guide.</p>'}
      </div>
    </section>

    ${plan.careerContext.alignedSources.length ? `
      <section class="coach-section">
        <div class="section-title-row"><div><h2>What your job descriptions add</h2><p>Extra context that may help you remember useful detail</p></div></div>
        <div class="career-alignment-list">${plan.careerContext.alignedSources.map((source) => `<article><strong>${escapeHtml(source.label)}</strong><div class="keyword-wrap">${source.matchedTerms.map((term) => `<span class="keyword source">${escapeHtml(term)}</span>`).join('')}</div></article>`).join('')}</div>
      </section>` : ''}

    <section class="coach-section coach-final">
      <div class="section-title-row"><div><h2>Final pass before you apply</h2><p>A quick tailoring checklist</p></div></div>
      <ul class="coach-checklist">${plan.checklist.map(renderChecklistItem).join('')}</ul>
      <div class="coach-next-step">
        <strong>Then make the edits in Resume.</strong>
        <span>Use Preview and Readiness review for the final check, and save a separate tailored copy for this application.</span>
      </div>
    </section>
  `;
}

// Compatibility export while older references are removed.
export const renderOptimizedPanel = renderCoachingPanel;
