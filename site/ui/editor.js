import { escapeHtml, field } from './shared.js';

export function renderResumeEditor(resume, panel) {
  const p = resume.profile;
  panel.innerHTML = `
    <div class="panel-intro">
      <h1>Build the master resume</h1>
      <p>Use clear, standard sections and evidence-rich accomplishments. BespokeCV keeps the output single-column and parser-safe by design.</p>
    </div>
    <section class="form-section" aria-labelledby="identity-title">
      <div class="section-title-row"><h2 id="identity-title">Identity & positioning</h2><p>Visible at the top of page one</p></div>
      <div class="field-grid">
        ${field('Full name', 'profile.fullName', p.fullName, { placeholder: 'Jordan Taylor', autocomplete: 'name' })}
        ${field('City, state / region', 'profile.cityState', p.cityState, { placeholder: 'Irvine, CA', autocomplete: 'address-level2' })}
        ${field('Email', 'profile.email', p.email, { type: 'email', placeholder: 'jordan@example.com', autocomplete: 'email' })}
        ${field('Phone', 'profile.phone', p.phone, { type: 'tel', placeholder: '555-555-0100', autocomplete: 'tel' })}
        ${field('LinkedIn', 'profile.linkedin', p.linkedin, { placeholder: 'linkedin.com/in/…' })}
        ${field('Portfolio / professional site', 'profile.portfolio', p.portfolio, { placeholder: 'portfolio.example.com' })}
        ${field('Professional headline', 'profile.headline', p.headline, { placeholder: 'Clinical Quality Coordinator | Sterile Compounding & Regulatory Readiness', full: true })}
        ${field('Professional summary', 'profile.summary', p.summary, { type: 'textarea', placeholder: '2–3 concise sentences showing scope, strengths, and differentiated evidence.', full: true, rows: 4 })}
      </div>
      <p class="help">Use a recognizable target-role title where truthful. Avoid objective statements that focus on what you want rather than what you offer.</p>
    </section>
    <section class="form-section" aria-labelledby="skills-title">
      <div class="section-title-row"><h2 id="skills-title">Skills</h2><p>Focused, searchable terminology</p></div>
      ${field('Skills (comma or line separated)', 'skillsText', resume.skills.join(', '), { type: 'textarea', full: true, placeholder: 'USP <797>, sterile compounding, quality auditing, policy development…', rows: 3 })}
      <p class="help">Prefer concrete tools, methods, credentials, and domain capabilities. Evidence key skills again in experience bullets rather than relying on a keyword list alone.</p>
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
      ${field('Certifications (one per line)', 'certificationsText', resume.certifications.join('\n'), { type: 'textarea', full: true, placeholder: 'Certified Pharmacy Technician (CPhT)', rows: 3 })}
    </section>`;
}

function renderExperienceCard(resume, role, index) {
  return `<article class="role-card" data-index="${index}">
    <div class="role-card-header"><strong>Position ${index + 1}</strong>${resume.experiences.length > 1 ? `<button class="icon-button" type="button" data-action="remove-experience" data-index="${index}">Remove</button>` : ''}</div>
    <div class="field-grid">
      ${field('Job title', `experiences.${index}.title`, role.title, { placeholder: 'Clinical Quality Coordinator' })}
      ${field('Employer', `experiences.${index}.company`, role.company, { placeholder: 'Company name' })}
      ${field('Location', `experiences.${index}.location`, role.location, { placeholder: 'Remote / City, State' })}
      ${field('Start', `experiences.${index}.start`, role.start, { placeholder: 'Oct 2022' })}
      ${field('End', `experiences.${index}.end`, role.end, { placeholder: role.current ? 'Present' : 'Sep 2026' })}
    </div>
    <label class="inline-check"><input type="checkbox" data-path="experiences.${index}.current" ${role.current ? 'checked' : ''}> Current role</label>
    <div class="form-section">
      <div class="section-title-row"><h2>Accomplishment bullets</h2><p>Action + scope + evidence/result</p></div>
      ${role.bullets.map((bullet, bulletIndex) => `<div class="bullet-row"><label class="field"><span>Bullet ${bulletIndex + 1}</span><textarea data-path="experiences.${index}.bullets.${bulletIndex}" placeholder="Led…, reducing… by 28% across 14 sites.">${escapeHtml(bullet)}</textarea></label>${role.bullets.length > 1 ? `<button class="icon-button" type="button" data-action="remove-bullet" data-role="${index}" data-bullet="${bulletIndex}" aria-label="Remove bullet ${bulletIndex + 1}">Remove</button>` : ''}</div>`).join('')}
      <button class="add-button" type="button" data-action="add-bullet" data-index="${index}">+ Add bullet</button>
    </div>
  </article>`;
}

function renderEducationCard(resume, item, index) {
  return `<article class="education-card">
    <div class="role-card-header"><strong>Education ${index + 1}</strong>${resume.education.length > 1 ? `<button class="icon-button" type="button" data-action="remove-education" data-index="${index}">Remove</button>` : ''}</div>
    <div class="field-grid">
      ${field('Degree / program', `education.${index}.degree`, item.degree, { placeholder: 'B.S. Business Administration' })}
      ${field('School', `education.${index}.school`, item.school, { placeholder: 'University name' })}
      ${field('Location', `education.${index}.location`, item.location, { placeholder: 'City, State' })}
      ${field('Graduation / completion', `education.${index}.graduation`, item.graduation, { placeholder: '2022' })}
    </div>
  </article>`;
}
