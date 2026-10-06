import { buildOptimizedDraft } from '../lib/optimizer.js';
import { escapeHtml } from './shared.js';

function statusLabel(status) {
  if (status === 'supported') return 'Supported';
  if (status === 'review') return 'Verify / partial';
  return 'Evidence gap';
}

function renderRequirement(item) {
  const evidence = item.evidence?.length
    ? `<ul class="evidence-list">${item.evidence.map((entry) => `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.text)}</li>`).join('')}</ul>`
    : '';
  return `<article class="gap-comment ${item.status}">
    <div class="gap-comment-head"><mark class="gap-highlight ${item.status}">${escapeHtml(statusLabel(item.status))}</mark><span>${escapeHtml(item.type)}</span></div>
    <p class="gap-requirement">${escapeHtml(item.text)}</p>
    ${evidence}
    <p class="gap-coach"><strong>Coach:</strong> ${escapeHtml(item.comment)}</p>
  </article>`;
}

function renderExperience(role) {
  const dates = [role.start, role.current ? 'Present' : role.end].filter(Boolean).join(' – ');
  return `<section class="optimized-role">
    <div class="optimized-role-line"><strong>${escapeHtml(role.title || 'Role')}</strong><span>${escapeHtml(dates)}</span></div>
    <div class="optimized-role-meta">${escapeHtml([role.company, role.location].filter(Boolean).join(' | '))}</div>
    ${role.bullets.length ? `<ul>${role.bullets.map((item) => `<li>${escapeHtml(item.bullet)}${item.score > 0 ? '<span class="evidence-tag">target evidence</span>' : ''}</li>`).join('')}</ul>` : ''}
  </section>`;
}

export function renderOptimizedPanel(resume, panel) {
  if (!resume.jobDescription?.trim()) {
    panel.innerHTML = `<div class="panel-intro"><h1>Optimized draft</h1><p>Add the target job description first. This workspace builds an ideal target blueprint, maps your actual resume evidence into a tailored draft, and leaves unsupported requirements visibly marked rather than inventing qualifications.</p></div><div class="notice"><strong>Target role required:</strong><span>Open Target role and paste/import the complete posting to activate the optimized draft.</span></div>`;
    return;
  }

  const draft = buildOptimizedDraft(resume);
  const profile = resume.profile;
  const contact = [profile.cityState, profile.phone, profile.email].filter(Boolean).join(' | ');
  const requiredGaps = draft.gaps.required;
  const preferredGaps = draft.gaps.preferred;

  panel.innerHTML = `
    <div class="panel-intro">
      <h1>Optimized & ideal draft</h1>
      <p>Compare the posting’s hypothetical “meets-all-requirements” blueprint with a personalized draft built only from evidence in your resume. Unsupported or uncertain qualifications stay highlighted with coaching comments instead of being fabricated.</p>
    </div>

    <div class="optimization-key" role="note">
      <span><i class="key-dot supported"></i>Supported by resume evidence</span>
      <span><i class="key-dot review"></i>Partial / verify manually</span>
      <span><i class="key-dot gap"></i>No supporting evidence found</span>
    </div>

    <div class="optimized-grid">
      <section class="ideal-card" aria-labelledby="ideal-title">
        <div class="optimized-card-head"><span class="eyebrow">Reference only — hypothetical</span><h2 id="ideal-title">Ideal target blueprint</h2><p>This is what a generic candidate satisfying the posting would need to communicate. It is not presented as your experience.</p></div>
        <div class="ideal-resume">
          <h3>${escapeHtml(draft.idealReference.headline)}</h3>
          ${draft.company ? `<p class="ideal-company">${escapeHtml(draft.company)}</p>` : ''}
          <h4>Target summary</h4>
          <p>${escapeHtml(draft.idealReference.summary)}</p>
          <h4>Core capabilities</h4>
          <div class="keyword-wrap">${draft.idealReference.capabilities.map((term) => `<span class="keyword">${escapeHtml(term)}</span>`).join('')}</div>
          <h4>Ideal evidence pattern</h4>
          <ul>${draft.idealReference.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>
        </div>
      </section>

      <section class="personalized-card" aria-labelledby="personalized-title">
        <div class="optimized-card-head"><span class="eyebrow">Evidence-grounded</span><h2 id="personalized-title">Personalized optimized draft</h2><p>Existing facts are retained; skills and bullets are prioritized for the target role. Review before export or use.</p></div>
        <article class="optimized-resume">
          <h2>${escapeHtml(profile.fullName || 'Your Name')}</h2>
          <p class="optimized-contact">${escapeHtml(contact)}</p>
          <p class="optimized-headline">${escapeHtml(draft.personalized.headline)}</p>

          <h3>Summary</h3>
          <p>${escapeHtml(draft.personalized.summary)}</p>
          ${requiredGaps.length ? `<p class="inline-gap-line"><mark class="gap-highlight review">${requiredGaps.length} required qualification${requiredGaps.length === 1 ? '' : 's'} need evidence review</mark></p>` : ''}

          <h3>Skills</h3>
          <p>${escapeHtml(draft.personalized.skills.join(' | '))}</p>
          ${draft.personalized.suggestedSkills.length ? `<div class="suggested-language"><strong>Evidence-supported wording to consider:</strong> ${draft.personalized.suggestedSkills.map((term) => `<mark class="supported-language">${escapeHtml(term)}</mark>`).join(' ')}</div>` : ''}

          <h3>Work Experience</h3>
          ${draft.personalized.experiences.map(renderExperience).join('')}

          ${draft.personalized.education.some((item) => item.school || item.degree) ? `<h3>Education</h3>${draft.personalized.education.filter((item) => item.school || item.degree).map((item) => `<p><strong>${escapeHtml(item.degree)}</strong>${item.school ? ` — ${escapeHtml(item.school)}` : ''}${item.graduation ? ` <span class="optimized-date">${escapeHtml(item.graduation)}</span>` : ''}</p>`).join('')}` : ''}

          ${draft.personalized.certifications.some(Boolean) ? `<h3>Certifications</h3>${draft.personalized.certifications.filter(Boolean).map((item) => `<p>${escapeHtml(item)}</p>`).join('')}` : ''}
        </article>
      </section>
    </div>

    <section class="form-section gap-review-section">
      <div class="section-title-row"><h2>Redline gap comments</h2><p>Never auto-filled without evidence</p></div>
      <p class="help">These comments compare the posting against the resume currently loaded in BespokeCV. “No evidence found” means the app could not substantiate the requirement from the resume text; it does not prove that you lack the experience.</p>
      <div class="gap-summary">
        <span class="gap-count required"><strong>${requiredGaps.length}</strong> required items to verify</span>
        <span class="gap-count preferred"><strong>${preferredGaps.length}</strong> preferred items to verify</span>
        <span class="gap-count language"><strong>${draft.gaps.missingTerms.length}</strong> target concepts not represented</span>
      </div>
      <div class="gap-comments">
        ${draft.requirements.length ? draft.requirements.map(renderRequirement).join('') : '<p class="help">No explicit required/preferred qualification statements were detected in the posting.</p>'}
      </div>
    </section>

    ${draft.gaps.missingTerms.length ? `<section class="form-section"><div class="section-title-row"><h2>Unrepresented target concepts</h2><p>Investigate, do not stuff</p></div><div class="keyword-wrap">${draft.gaps.missingTerms.map((item) => `<span class="keyword missing">${escapeHtml(item.term)}</span>`).join('')}</div><p class="help">Only add a concept when you can support it with truthful skills, experience, education, or credentials. A missing chip is a prompt to investigate evidence—not a command to add a keyword.</p></section>` : ''}
  `;
}
