import { escapeHtml, field } from './shared.js';

export function renderResumeEditor(resume, panel) {
  const p = resume.profile;
  const source = resume.importedSource ?? {};
  panel.innerHTML = `
    <div class="panel-intro">
      <h1>Build the master resume</h1>
      <p>Start from an existing resume whenever possible. BespokeCV extracts document text locally, builds an editable draft, and keeps manual entry available for corrections or a fresh start.</p>
    </div>

    <section class="intake-card" aria-labelledby="resume-intake-title">
      <div>
        <span class="eyebrow">Recommended starting point</span>
        <h2 id="resume-intake-title">Import your existing resume</h2>
        <p>Word (.docx) and PDF are parsed in this browser. The file is not uploaded to a BespokeCV server.</p>
      </div>
      <div class="intake-actions">
        <button class="btn primary" type="button" data-action="upload-resume">Choose resume file</button>
        <span class="help">Also accepts TXT and BespokeCV JSON backups · maximum 12 MB</span>
      </div>
      ${source.fileName ? `<div class="source-chip"><strong>Imported:</strong> ${escapeHtml(source.fileName)} <span>(${escapeHtml((source.format || '').toUpperCase())})</span></div>` : ''}
      <details class="paste-fallback">
        <summary>Paste resume text instead</summary>
        <label class="field full"><span>Resume text</span><textarea id="resumePasteText" rows="10" placeholder="Paste the text from your resume here if you cannot attach the document."></textarea></label>
        <button class="btn ghost" type="button" data-action="import-pasted-resume">Build draft from pasted text</button>
      </details>
      <div class="notice"><strong>Review after import:</strong><span>Document parsing is intentionally conservative. Confirm names, dates, employers, education, and bullet grouping before exporting.</span></div>
    </section>

    <section class="form-section" aria-labelledby="identity-title">
      <div class="section-title-row"><h2 id="identity-title">Identity & positioning</h2><p>Visible at the top of page one</p></div>
      <div class="field-grid">
        ${field('Full name', 'profile.fullName', p.fullName, { placeholder: 'Full Name', autocomplete: 'name' })}
        ${field('City, state / region', 'profile.cityState', p.cityState, { placeholder: 'City, State / Region', autocomplete: 'address-level2' })}
        ${field('Email', 'profile.email', p.email, { type: 'email', placeholder: 'name@example.com', autocomplete: 'email' })}
        ${field('Phone', 'profile.phone', p.phone, { type: 'tel', placeholder: '555-555-0100', autocomplete: 'tel' })}
        ${field('LinkedIn', 'profile.linkedin', p.linkedin, { placeholder: 'linkedin.com/in/your-profile' })}
        ${field('Portfolio / professional site', 'profile.portfolio', p.portfolio, { placeholder: 'your-site.example' })}
        ${field('Professional headline', 'profile.headline', p.headline, { placeholder: 'Target Role | Specialty | Industry or Domain', full: true })}
        ${field('Professional summary', 'profile.summary', p.summary, { type: 'textarea', placeholder: 'Summarize your experience, scope, strengths, and the value you bring in 2–3 concise sentences.', full: true, rows: 4 })}
      </div>
      <p class="help">Use a recognizable target-role title where truthful. Avoid objective statements that focus on what you want rather than what you offer.</p>
    </section>

    <section class="form-section" aria-labelledby="skills-title">
      <div class="section-title-row"><h2 id="skills-title">Skills</h2><p>Focused, searchable terminology</p></div>
      ${field('Skills (comma or line separated)', 'skillsText', resume.skills.join(', '), { type: 'textarea', full: true, placeholder: 'Project management, data analysis, customer research, process improvement, SQL', rows: 3 })}
      <p class="help">Prefer concrete tools, methods, credentials, and domain capabilities. Evidence important skills again in experience bullets rather than relying on a keyword list alone.</p>
    </section>

    <section class="form-section" aria-labelledby="experience-title">
      <div class="section-title-row"><h2 id="experience-title">Work Experience</h2><p>Reverse chronological</p></div>
      <div id="experienceCards">${resume.experiences.map((role, index) => renderExperienceCard(resume, role, index)).join('')}</div>
      <button class="add-button" type="button" data-action="add-experience">+ Add position</button>
    </section>

    <section class="form-section" aria-labelledby="education-title">
      <div class="section-title-row"><h2 id="education-title">Education</h2><p>Keep concise unless role-relevant</p></div>
      <div id="educationCards">${resume.education.map((item, index) => renderEducationCard(resume, item, index)).join('')}</div>
      <button class="add-button" type="button" data-action="add-education">+ Add education</button>
    </section>

    <section class="form-section" aria-labelledby="cert-title">
      <div class="section-title-row"><h2 id="cert-title">Certifications</h2><p>Use complete credential names</p></div>
      ${field('Certifications (one per line)', 'certificationsText', resume.certifications.join('\n'), { type: 'textarea', full: true, placeholder: 'Professional certification or license', rows: 3 })}
    </section>`;
}

function renderExperienceCard(resume, role, index) {
  return `<article class="role-card" data-index="${index}">
    <div class="role-card-header"><strong>Position ${index + 1}</strong>${resume.experiences.length > 1 ? `<button class="icon-button" type="button" data-action="remove-experience" data-index="${index}">Remove</button>` : ''}</div>
    <div class="field-grid">
      ${field('Job title', `experiences.${index}.title`, role.title, { placeholder: 'Job Title' })}
      ${field('Employer', `experiences.${index}.company`, role.company, { placeholder: 'Organization name' })}
      ${field('Location', `experiences.${index}.location`, role.location, { placeholder: 'City, State / Region or Remote' })}
      ${field('Start', `experiences.${index}.start`, role.start, { placeholder: 'Jan 2021' })}
      ${field('End', `experiences.${index}.end`, role.end, { placeholder: role.current ? 'Present' : 'Dec 2025' })}
    </div>
    <label class="inline-check"><input type="checkbox" data-path="experiences.${index}.current" ${role.current ? 'checked' : ''}> Current role</label>
    <div class="form-section">
      <div class="section-title-row"><h2>Accomplishment bullets</h2><p>Action + scope + evidence/result</p></div>
      ${role.bullets.map((bullet, bulletIndex) => `<div class="bullet-row"><label class="field"><span>Bullet ${bulletIndex + 1}</span><textarea data-path="experiences.${index}.bullets.${bulletIndex}" placeholder="Describe what you changed, the scope of the work, and the result or evidence.">${escapeHtml(bullet)}</textarea></label>${role.bullets.length > 1 ? `<button class="icon-button" type="button" data-action="remove-bullet" data-role="${index}" data-bullet="${bulletIndex}" aria-label="Remove bullet ${bulletIndex + 1}">Remove</button>` : ''}</div>`).join('')}
      <button class="add-button" type="button" data-action="add-bullet" data-index="${index}">+ Add bullet</button>
    </div>
  </article>`;
}

function renderEducationCard(resume, item, index) {
  return `<article class="education-card">
    <div class="role-card-header"><strong>Education ${index + 1}</strong>${resume.education.length > 1 ? `<button class="icon-button" type="button" data-action="remove-education" data-index="${index}">Remove</button>` : ''}</div>
    <div class="field-grid">
      ${field('Degree / program', `education.${index}.degree`, item.degree, { placeholder: 'Degree, diploma, certificate, or program' })}
      ${field('School', `education.${index}.school`, item.school, { placeholder: 'School or institution' })}
      ${field('Location', `education.${index}.location`, item.location, { placeholder: 'City, State / Region' })}
      ${field('Graduation / completion', `education.${index}.graduation`, item.graduation, { placeholder: 'Year or expected date' })}
    </div>
  </article>`;
}
