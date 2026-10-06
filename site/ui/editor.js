import { escapeHtml, field } from './shared.js';

export function renderResumeEditor(resume, panel, { activeTab = 'resume' } = {}) {
  panel.innerHTML = `
    <div class="panel-intro">
      <h1>Career information</h1>
      <p>Build from your resume and optional current/previous job descriptions. BespokeCV keeps these sources separate so formal duty information can improve tailoring without being mistaken for accomplishments.</p>
    </div>

    <div class="content-tabs" role="tablist" aria-label="Career information">
      <button class="content-tab ${activeTab === 'resume' ? 'active' : ''}" type="button" data-resume-subtab="resume" role="tab" aria-selected="${String(activeTab === 'resume')}">Resume</button>
      <button class="content-tab ${activeTab === 'job-descriptions' ? 'active' : ''}" type="button" data-resume-subtab="job-descriptions" role="tab" aria-selected="${String(activeTab === 'job-descriptions')}">Job Descriptions</button>
    </div>

    <div class="content-tab-panel" role="tabpanel">
      ${activeTab === 'job-descriptions' ? renderCareerSources(resume) : renderResumeContent(resume)}
    </div>
  `;
}

function renderResumeContent(resume) {
  const p = resume.profile;
  const source = resume.importedSource ?? {};
  return `
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

function renderCareerSources(resume) {
  const sources = Array.isArray(resume.careerSources) && resume.careerSources.length ? resume.careerSources : [];
  const usableCount = sources.filter((source) => source.text?.trim() || source.fileText?.trim()).length;
  return `
    <section class="intake-card career-source-intro" aria-labelledby="career-source-title">
      <div>
        <span class="eyebrow">Optional supporting evidence</span>
        <h2 id="career-source-title">Current & previous job descriptions</h2>
        <p>Add formal job descriptions, duty statements, role summaries, or comparable source text that describes work you were expected to perform. BespokeCV uses these sources to make tailoring recommendations more specific.</p>
      </div>
      <div class="notice"><strong>Evidence boundary:</strong><span>A job description can support role context, terminology, systems, processes, and standards. It does not prove that you personally completed an accomplishment or achieved a result.</span></div>
      <p class="help">${usableCount} source${usableCount === 1 ? '' : 's'} currently contain supporting text. Documents are parsed locally and the extracted text is saved with your BespokeCV data.</p>
    </section>

    <section class="career-source-list" aria-label="Job description sources">
      ${sources.map((source, index) => renderCareerSourceCard(source, index, sources.length)).join('')}
    </section>
    <button class="add-button" type="button" data-action="add-career-source">+ Add another job description</button>
  `;
}

function renderCareerSourceCard(source, index, total) {
  const fileInfo = source.fileName
    ? `<div class="source-file-row"><div class="source-chip"><strong>Attached:</strong> ${escapeHtml(source.fileName)} <span>(${escapeHtml((source.fileFormat || '').toUpperCase())})</span></div><button class="icon-button" type="button" data-action="clear-career-file" data-index="${index}">Delete attached file</button></div>`
    : '<p class="help">No document attached. You can use the text field by itself.</p>';

  return `<article class="career-source-card" data-index="${index}">
    <div class="role-card-header">
      <div><strong>Job description ${index + 1}</strong><span class="career-source-state">${source.fileText?.trim() || source.text?.trim() ? ' · information added' : ''}</span></div>
      ${total > 1 ? `<button class="icon-button" type="button" data-action="remove-career-source" data-index="${index}">Remove</button>` : ''}
    </div>

    <div class="field-grid">
      ${field('Role / source label (optional)', `careerSources.${index}.label`, source.label, { placeholder: 'Role title, employer, or source name', full: true })}
    </div>

    <div class="career-file-picker">
      <label class="field full">
        <span>Attach job-description document</span>
        <input class="career-file-input" type="file" data-career-file-index="${index}" accept=".docx,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain">
      </label>
      <span class="help">Word (.docx), PDF, or TXT · maximum 12 MB · parsed locally</span>
      ${fileInfo}
    </div>

    <div class="career-text-block">
      <label class="field full">
        <span>Additional / pasted job-description text</span>
        <textarea data-path="careerSources.${index}.text" rows="11" placeholder="Paste or add responsibilities, duties, systems, standards, scope, and other role-specific information here.">${escapeHtml(source.text)}</textarea>
      </label>
      <div class="career-source-actions">
        <button class="btn ghost" type="button" data-action="clear-career-text" data-index="${index}" ${source.text?.trim() ? '' : 'disabled'}>Clear text</button>
      </div>
    </div>
  </article>`;
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
