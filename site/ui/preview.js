import { escapeHtml } from './shared.js';

export function renderPreview(resume, preview) {
  const p = resume.profile;
  const skills = resume.skills.filter(Boolean);
  const roles = resume.experiences.filter((role) => role.title || role.company || role.bullets.some(Boolean));
  const education = resume.education.filter((item) => item.degree || item.school);
  const certs = resume.certifications.filter(Boolean);
  preview.innerHTML = `
    <h1 class="resume-name">${escapeHtml(p.fullName || 'Your Name')}</h1>
    <p class="resume-contact">${escapeHtml([p.cityState,p.phone,p.email].filter(Boolean).join(' | ') || 'City, State | phone | email')}</p>
    ${p.linkedin || p.portfolio ? `<p class="resume-links">${escapeHtml([p.linkedin,p.portfolio].filter(Boolean).join(' | '))}</p>` : ''}
    <p class="resume-headline">${escapeHtml(p.headline || 'Target role / professional specialty')}</p>
    <section class="resume-section"><h2>Summary</h2><p class="${p.summary ? '' : 'resume-empty'}">${escapeHtml(p.summary || 'Add a concise, role-focused professional summary with scope and evidence.')}</p></section>
    ${skills.length ? `<section class="resume-section"><h2>Skills</h2><p>${escapeHtml(skills.join(' | '))}</p></section>` : ''}
    <section class="resume-section"><h2>Work Experience</h2>${roles.length ? roles.map((role)=>`<div class="resume-role"><div class="role-line"><span>${escapeHtml(role.title || 'Job Title')}${role.company ? ` — ${escapeHtml(role.company)}` : ''}</span><span>${escapeHtml([role.start,role.current ? 'Present' : role.end].filter(Boolean).join(' – '))}</span></div><div class="role-meta"><span>${escapeHtml(role.location)}</span></div>${role.bullets.filter(Boolean).length ? `<ul>${role.bullets.filter(Boolean).map((bullet)=>`<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : '<p class="resume-empty">Add accomplishment bullets.</p>'}</div>`).join('') : '<p class="resume-empty">Add your relevant work history.</p>'}</section>
    ${education.length ? `<section class="resume-section"><h2>Education</h2>${education.map((item)=>`<div class="resume-role"><div class="education-line"><span>${escapeHtml(item.degree)}${item.school ? ` — ${escapeHtml(item.school)}` : ''}</span><span>${escapeHtml(item.graduation)}</span></div><div class="education-meta"><span>${escapeHtml(item.location)}</span></div></div>`).join('')}</section>` : ''}
    ${certs.length ? `<section class="resume-section"><h2>Certifications</h2>${certs.map((item)=>`<p>${escapeHtml(item)}</p>`).join('')}</section>` : ''}`;
}
